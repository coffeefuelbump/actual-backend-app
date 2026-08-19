// src/components/Dashboard.js

import React, { useEffect, useState, useRef } from 'react';
import './Dashboard.css';
import { auth, db, functions, storage } from './../firebase'; // Ensure 'storage' is exported from your firebase config
import { signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom'; // If using react-router
import UserPrompts from './UserPrompts'; // Import the UserPrompts component
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload } from '@fortawesome/free-solid-svg-icons'; // Import the upload icon
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'; // Import storage functions

// STRIPE
import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe outside the component to ensure it's loaded only once
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY); // Ensure REACT_APP_STRIPE_PUBLIC_KEY is set in your .env

const Dashboard = () => {
  const [userProfile, setUserProfile] = useState({
    profileImage: '',
    userEmail: '',
  });
  const [prompts, setPrompts] = useState([]); // State for prompts array
  const [AIResponses, setAIResponses] = useState([]); // State for AI responses array
  const [loading, setLoading] = useState(true); // For loading state
  const [error, setError] = useState(null); // For error handling
  const [uploading, setUploading] = useState(false); // For upload loading state
  const [uploadError, setUploadError] = useState(null); // For upload error
  const navigate = useNavigate(); // If using react-router
  const fileInputRef = useRef(null); // Ref for hidden file input

  // Purchase State
  const [purchaseButtonText, setPurchaseButtonText] = useState("Purchase");

  // Fixed price
  const purchasePrice = "5.00"; // Fixed price of $5.00

  const initiatePurchase = async () => {
    setPurchaseButtonText("Processing...");
    try {
      const functionsInstance = functions;
      const createSession = httpsCallable(functionsInstance, 'startPaymentSession'); // Renamed cloud function

      // Retrieve gclid from localStorage if needed
      const gclid = localStorage.getItem('gclid') || '';

      // Prepare payload
      const payload = {
        plan: 'Messagly', // Fixed plan name
        gclid: gclid,
      };

      // Call the Firebase function with the prepared payload
      const response = await createSession(payload);
      
      const { sessionId } = response.data;
      const stripe = await stripePromise;

      // Redirect to Stripe Checkout
      const { error } = await stripe.redirectToCheckout({ sessionId });

      if (error) {
        // Handle Stripe redirection errors
        setPurchaseButtonText("Retry");
      } else {
        // Reset button text if redirection is successful
        setPurchaseButtonText("Purchase");
      }
    } catch (err) {
      // Handle errors from the backend function
      console.error('Purchase Error:', err);
      setPurchaseButtonText("Retry");
    }
  };

  const handlePurchaseClick = () => {
    initiatePurchase();
  };


  useEffect(() => {
    const fetchUserProfile = async () => {
      const user = auth.currentUser;
      console.log("Current user:", user); // Log the current user object for debugging

      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid); // Path to 'users/{userId}'
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            setUserProfile(userDoc.data().userProfile);
          } else {
            console.log('No such document!');
            setError('User profile not found.');
          }
        } catch (err) {
          console.error('Error fetching user profile:', err);
          setError('Failed to fetch user profile.');
        }
      }
    };

    const fetchData = async () => {
      await fetchUserProfile();
      setLoading(false);
    };

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchData();

        // Set up Firestore listener for prompts
        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribePrompts = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setPrompts(data.prompts || []);
            setAIResponses(data.AIResponses || []);
          } else {
            console.log('No such document for prompts!');
            setPrompts([]);
            setAIResponses([]);
          }
        }, (err) => {
          console.error('Error fetching prompts and AI responses:', err);
          setError('Failed to fetch prompts and AI responses.');
        });

        // Cleanup Firestore listener on unmount or user change
        return () => {
          unsubscribePrompts();
        };
      } else {
        navigate('/login'); // Redirect to login if not authenticated
      }
    });

    return () => unsubscribeAuth();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login'); // Redirect to login after logout
    } catch (err) {
      console.error('Error signing out:', err);
      setError('Failed to log out.');
    }
  };

  const handleUserPromptSubmit = async (prompt) => {
    const user = auth.currentUser;
    if (user) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        // Add the prompt to 'prompts' array
        await updateDoc(userDocRef, {
          prompts: arrayUnion(prompt),
        });

        // Call the Firebase Cloud Function to generate AI response
        const generateAI = httpsCallable(functions, 'generate_completion');
        const result = await generateAI({ userPrompt: prompt });

        if (result.data && result.data.reply) {
          const aiReply = result.data.reply;
          // Add the AI response to 'AIResponses' array
          await updateDoc(userDocRef, {
            AIResponses: arrayUnion(aiReply),
          });
        } else {
          console.error('Invalid response from Cloud Function:', result.data);
          setError('Failed to get a valid response from AI.');
        }
      } catch (err) {
        console.error('Error handling user prompt submission:', err);
        setError('Failed to submit prompt or retrieve AI response.');
      }
    } else {
      setError('User not authenticated.');
    }
  };

  // Handler for file input change
  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    const user = auth.currentUser;
    if (!user) {
      setUploadError('User not authenticated.');
      setUploading(false);
      return;
    }

    // Check file size (e.g., 2 GB limit)
    if (file.size > 2 * 1024 * 1024 * 1024) {
      setUploadError('File size exceeds 2 GB.');
      setUploading(false);
      return;
    }

    try {
      // Create a storage reference
      const storageRefInstance = ref(storage, `profile_pictures/${user.uid}/${file.name}`);
      
      // Upload the file
      await uploadBytes(storageRefInstance, file);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(storageRefInstance);

      // Update the user's profile in Firestore
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        'userProfile.profileImage': downloadURL,
      });

      // Update local state
      setUserProfile((prevProfile) => ({
        ...prevProfile,
        profileImage: downloadURL,
      }));

    } catch (err) {
      console.error('Error uploading file:', err);
      setUploadError('Failed to upload image.');
    } finally {
      setUploading(false);
    }
  };

  // Function to trigger the hidden file input
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <p className="loading">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <p className="error-message">{error}</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <h1 className="dashboard-header">Welcome to Messagly Dashboard!</h1>
      
      <div className="profile-section">
        {userProfile.profileImage ? (
          <img
            src={userProfile.profileImage}
            alt="Profile"
            className="profile-image"
          />
        ) : (
          <div className="profile-placeholder">No Image</div>
        )}
        <span className="user-email">{userProfile.userEmail}</span>

        {/* Upload Button/Icon */}
        <div className="upload-section">
          <FontAwesomeIcon 
            icon={faUpload} 
            className="upload-icon" 
            onClick={triggerFileInput} 
            title="Upload Profile Image" 
          />
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          {uploading && <p className="uploading">Uploading...</p>}
          {uploadError && <p className="upload-error">{uploadError}</p>}
        </div>
      </div>

      {/* Purchase Section */}
      <div className="purchase-section">
        <h2>Purchase Messagly Credits</h2>
        <p>Get Messagly credits for your account.</p>
        <button className="purchase-button" onClick={handlePurchaseClick}>
          {purchaseButtonText}
        </button>
        <p className="purchase-price">${purchasePrice} USD</p>
      </div>

      {/* Insert the UserPrompts component here */}
      <UserPrompts prompts={prompts} onSubmit={handleUserPromptSubmit} />

      {/* Display AI Responses */}
      <div className="ai-responses-section">
        <h2>AI Responses:</h2>
        {AIResponses.length > 0 ? (
          <ul className="ai-responses-list">
            {AIResponses.map((response, index) => (
              <li key={index} className="ai-response-item">
                {response}
              </li>
            ))}
          </ul>
        ) : (
          <p className="no-ai-responses">No AI responses yet.</p>
        )}
      </div>

      <button className="logout-button" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
};

export default Dashboard;
