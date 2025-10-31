#!/usr/bin/env python3

"""
Gemini AI Service for Voice Coach
Handles all interactions with Google's Gemini API
"""

import logging
import random
import google.generativeai as genai
from config import Config

logger = logging.getLogger(__name__)

class GeminiService:
    """Service for interacting with Gemini AI API"""
    
    def __init__(self):
        self.api_key = Config.GEMINI_API_KEY
        self.model_name = None
        self.model = None
        self._configure_api()
    
    def _configure_api(self):
        """Configure Gemini API and select best available model"""
        try:
            genai.configure(api_key=self.api_key)
            self._select_model()
        except Exception as e:
            logger.error(f"Failed to configure Gemini API: {e}")
            raise
    
    def _select_model(self):
        """Select the best available Gemini model"""
        try:
            # List available models
            models = genai.list_models()
            available_models = [
                m.name for m in models 
                if 'generateContent' in m.supported_generation_methods
            ]
            
            logger.info(f"Available models: {available_models[:3]}")
            
            if available_models:
                self.model_name = available_models[0].replace('models/', '')
                logger.info(f"Using model: {self.model_name}")
                self.model = genai.GenerativeModel(self.model_name)
            else:
                # Fallback to default model
                logger.warning("No models found, using fallback")
                self.model = genai.GenerativeModel('models/gemini-1.5-flash')
                self.model_name = 'gemini-1.5-flash'
                
        except Exception as e:
            logger.error(f"Model selection failed: {e}")
            # Use fallback model
            self.model = genai.GenerativeModel('models/gemini-1.5-flash')
            self.model_name = 'gemini-1.5-flash'
    
    async def generate_response(self, user_input: str) -> str:
        """Generate response from Gemini AI"""
        try:
            logger.info(f"Generating response for: '{user_input[:50]}...'")
            
            # Create prompt
            prompt = f"User said: {user_input}"
            
            # Generate response
            response = self.model.generate_content(prompt)
            ai_response = response.text.strip()
            
            logger.info(f"✅ Generated {len(ai_response)} chars")
            logger.debug(f"Response preview: '{ai_response[:100]}...'")
            
            return ai_response
            
        except Exception as e:
            logger.error(f"Gemini API failed: {type(e).__name__}: {str(e)}")
            return self._get_fallback_response(user_input, e)
    
    def _get_fallback_response(self, user_input: str, error: Exception) -> str:
        """Generate fallback response when API fails"""
        # Check if it's a quota error
        if "quota" in str(error).lower() or "429" in str(error):
            logger.info("API quota exceeded - using mock response")
            return self._get_mock_response(user_input)
        else:
            logger.info("API error - using generic fallback")
            return f"I heard you say: '{user_input}'. I'm having trouble connecting to AI services right now, but your message was received."
    
    def _get_mock_response(self, user_input: str) -> str:
        """Generate mock response for testing when quota is exceeded"""
        mock_responses = [
            f"Thank you for saying '{user_input}'. That's a great point to discuss!",
            f"I heard '{user_input}' - that's interesting. Let me help you with that.",
            f"You mentioned '{user_input}'. That's a valuable insight. Here's my feedback...",
            f"Based on your input '{user_input}', I can provide some coaching advice."
        ]
        
        response = random.choice(mock_responses)
        logger.info(f"🎭 Mock response: {response}")
        return response
    
    def get_model_info(self) -> dict:
        """Get information about the current model"""
        return {
            "model_name": self.model_name,
            "api_configured": self.model is not None
        }
