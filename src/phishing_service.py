from fastapi import FastAPI, HTTPException, Header, Depends
from pydantic import BaseModel
import os
import aiohttp
from src.patched_parser_prediction import load_model_and_tokenizer, predict_with_sliding_window, generate_text_representation
from bs4 import BeautifulSoup
from typing import Optional

app = FastAPI()

# Load the model when the service starts
model_dir = os.path.join(os.path.dirname(__file__), "model")
model, tokenizer = load_model_and_tokenizer(model_dir)

class URLCheck(BaseModel):
    url: str

async def verify_api_key(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=403, detail="No API key provided")
    
    # Extract the key from "Bearer <key>"
    try:
        scheme, key = authorization.split()
        if scheme.lower() != 'bearer':
            raise HTTPException(status_code=403, detail="Invalid authorization scheme")
        
        if not key.startswith('sk-proj-'):
            raise HTTPException(status_code=403, detail="Invalid API key format")
        
        return key
    except ValueError:
        raise HTTPException(status_code=403, detail="Invalid authorization format")

@app.post("/check_url")
async def check_url(url_check: URLCheck, api_key: str = Depends(verify_api_key)):
    try:
        # Fetch the webpage content
        async with aiohttp.ClientSession() as session:
            async with session.get(url_check.url) as response:
                html_content = await response.text()
        
        # Parse HTML and generate text representation
        soup = BeautifulSoup(html_content, 'html.parser')
        text_representation = generate_text_representation(str(soup))
        
        # Make prediction using sliding window
        window_size = 512  # MobileBERT's max sequence length
        stride = 256
        prediction, confidence = predict_with_sliding_window(model, tokenizer, text_representation, window_size, stride)
        
        # Determine detailed reasons for phishing classification
        reasons = []
        if prediction == "phishing":
            if "login" in text_representation.lower() or "sign in" in text_representation.lower():
                reasons.append("Suspicious data collection")
            if "bank" in text_representation.lower() or "paypal" in text_representation.lower():
                reasons.append("Impersonation of legitimate services")
            if "urgent" in text_representation.lower() or "verify" in text_representation.lower():
                reasons.append("Deceptive website behavior")
            if confidence > 0.8:
                reasons.append("Known malicious patterns")
            if any(risk in text_representation.lower() for risk in ["password", "credit card", "ssn"]):
                reasons.append("Potential security risks")
        
        return {
            "status": "phishing" if prediction == "phishing" else "safe",
            "confidence": confidence,
            "reasons": reasons if prediction == "phishing" else []
        }
    except aiohttp.ClientError as e:
        raise HTTPException(status_code=400, detail=f"Error fetching URL: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
