#!/usr/bin/env python3

"""
Quick test script to verify Gemini API connectivity
"""

import asyncio
import httpx
from config import Config

async def test_gemini_api():
    """Test Gemini API connection"""
    print("🧪 Testing Gemini API Connection...")
    print(f"📋 API Key: {'*' * (len(Config.GEMINI_API_KEY) - 4)}{Config.GEMINI_API_KEY[-4:]}")
    
    # Test different models
    models_to_test = [
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash", 
        "gemini-1.5-pro-latest",
        "gemini-pro"
    ]
    
    for model in models_to_test:
        print(f"\n🔍 Testing model: {model}")
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": Config.GEMINI_API_KEY
        }
        
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": "Hello! This is a test. Please respond briefly."}
                    ]
                }
            ],
            "generationConfig": {
                "maxOutputTokens": 50
            }
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    headers=headers,
                    json=payload,
                    timeout=15.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    candidates = data.get('candidates', [])
                    if candidates:
                        content = candidates[0].get('content', {}).get('parts', [])
                        if content:
                            text = content[0].get('text', '')
                            print(f"✅ SUCCESS: {model}")
                            print(f"📝 Response: {text[:100]}...")
                            return model  # Return first working model
                        
                print(f"❌ FAILED: {model} - Status: {response.status_code}")
                if response.status_code != 200:
                    print(f"   Error: {response.text[:200]}...")
                    
        except Exception as e:
            print(f"❌ ERROR: {model} - {str(e)}")
    
    return None

if __name__ == "__main__":
    working_model = asyncio.run(test_gemini_api())
    if working_model:
        print(f"\n🎉 Working model found: {working_model}")
        print("💡 Update your service to use this model name")
    else:
        print("\n❌ No working models found")
        print("🔧 Please check your GEMINI_API_KEY configuration")
