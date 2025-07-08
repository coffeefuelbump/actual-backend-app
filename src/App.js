import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import "./App.css";
import HomePage from "./unAuth/HomePage";
import SignPage from "./unAuth/SignPage";
import Dashboard from "./Auth/Dashboard";
import { AuthProvider, useAuth } from "./AuthContext";
import "./firebase";
import { Helmet } from "react-helmet";

const REACT_APP_GA4_MEASUREMENT_ID = process.env.REACT_APP_GA4_MEASUREMENT_ID;

// Test 123

const PrivateRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return currentUser ? children : <Navigate to="/" />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Helmet>
            {REACT_APP_GA4_MEASUREMENT_ID && [
              <script
                key="gtag-js"
                async
                src={`https://www.googletagmanager.com/gtag/js?id=${REACT_APP_GA4_MEASUREMENT_ID}`}
              ></script>,
              <script key="gtag-init">
                {`
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${REACT_APP_GA4_MEASUREMENT_ID}', {
                    send_page_view: false,
                  });
                `}
              </script>,
            ]}
          </Helmet>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/signup" element={<SignPage />} />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
