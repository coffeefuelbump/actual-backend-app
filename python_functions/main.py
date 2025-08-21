# generate_completion.py

from firebase_functions import https_fn
from firebase_admin import initialize_app, firestore
from openai import OpenAI
from dotenv import load_dotenv
import stripe
import os
import requests
import pandas as pd

# Load environment variables from .env file
load_dotenv()

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

GA4_MEASUREMENT_ID = os.environ.get("GA4_MEASUREMENT_ID")
GA4_API_SECRET = os.environ.get("GA4_API_SECRET")
GA4_URL = f"https://www.google-analytics.com/mp/collect?measurement_id={GA4_MEASUREMENT_ID}&api_secret={GA4_API_SECRET}"

# Get OpenAI API Key from .env
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    raise ValueError("OPENAI_API_KEY is not set in the .env file")

# Initialize Firebase Admin SDK
initialize_app()
db = firestore.client()

# Initialize OpenAI Client
client = OpenAI(api_key=openai_api_key)

@https_fn.on_call()
def generate_completion(req: https_fn.CallableRequest) -> dict:
    try:
        if not req.auth:
            return {"error": "Authentication required."}

        uid = req.auth.uid
        if not uid:
            return {"error": "User UID not found."}

        user_prompt = req.data.get("userPrompt", "")
        if not user_prompt:
            return {"error": "userPrompt is required"}

        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": user_prompt}
            ]
        )

        assistant_message = response.choices[0].message.content.strip()
        print(f"OpenAI Response: {assistant_message}")

        user_doc_ref = db.collection('users').document(uid)
        user_doc_ref.update({
            'AIResponses': firestore.ArrayUnion([assistant_message])
        })

        return {"reply": assistant_message}

    except Exception as e:
        print(f"Error: {str(e)}")
        return {"error": str(e)}


@https_fn.on_call()
def startPaymentSession(req: https_fn.CallableRequest) -> dict:
    try:
        if not req.auth:
            return {"error": "Authentication required."}
        
        uid = req.auth.uid
        if not uid:
            return {"error": "User UID not found."}

        # Extract gclid and plan from the request data
        gclid = req.data.get("gclid", "")
        plan = req.data.get("plan", "Messagly")

        # Create a Stripe Checkout Session with metadata
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price": "price_1QWP6xGjBypHkVTGldP28xzF",
                "quantity": 1,
            }],
            mode="payment",
            success_url="http://localhost:3000/dashboard",
            cancel_url="http://localhost:3000/dashboard",
            metadata={"uid": uid, "gclid": gclid, "plan": plan}
        )

        # After creating the session, send the begin_checkout event to GA4
        send_ga4_begin_checkout_event(uid, gclid, plan)

        return {"sessionId": session.id}

    except Exception as e:
        print(f"Error creating payment session: {str(e)}")
        return {"error": str(e)}


def send_ga4_begin_checkout_event(user_id: str, gclid: str, plan_name: str):
    """Send the begin_checkout event to GA4."""
    if not GA4_MEASUREMENT_ID or not GA4_API_SECRET:
        print("GA4 environment variables not set, skipping event.")
        return

    event_params = {
        "currency": "USD",
        "value": 100,  # Example value, adjust as needed
        "items": [
            {
                "item_name": f"{plan_name} Plan",
                "quantity": 1
            }
        ]
    }

    # Include user_id and gclid if present
    if user_id:
        event_params["user_id"] = user_id
    if gclid:
        event_params["gclid"] = gclid

    payload = {
        "client_id": f"{user_id}",
        "user_id": user_id,
        "events": [
            {
                "name": "begin_checkout",
                "params": event_params
            }
        ]
    }

    try:
        response = requests.post(GA4_URL, json=payload)
        print(f"GA4 begin_checkout event status: {response.status_code}, response: {response.text}")
    except Exception as e:
        print(f"Error sending GA4 event: {str(e)}")


@https_fn.on_request()
def handle_stripe_webhook(req: https_fn.Request):
    endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    if not endpoint_secret:
        return ("Endpoint secret not set", 500)

    payload = req.get_data(as_text=True)
    sig = req.headers.get("Stripe-Signature", None)

    try:
        event = stripe.Webhook.construct_event(
            payload, sig, endpoint_secret
        )
    except ValueError:
        return ("Invalid payload", 400)
    except stripe.error.SignatureVerificationError:
        return ("Invalid signature", 400)

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        uid = session.get("metadata", {}).get("uid")

        if uid:
            user_doc_ref = db.collection('users').document(uid)
            user_doc_ref.update({
                "credits": firestore.Increment(100)
            })
            print(f"User {uid} has been granted 100 credits.")
        else:
            print("No UID found in session metadata.")

    return ("", 200)
