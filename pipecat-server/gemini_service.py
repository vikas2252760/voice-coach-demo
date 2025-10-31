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
        """Select the most efficient Gemini model for quota management"""
        try:
            # Prefer Flash models for better quota efficiency
            preferred_models = [
                'models/gemini-1.5-flash',  # Most quota-efficient
                'models/gemini-1.5-flash-8b',  # Ultra-lightweight
                'models/gemini-2.5-flash',  # Latest flash model
            ]
            
            # Try to use preferred models first for quota efficiency
            for model_name in preferred_models:
                try:
                    self.model = genai.GenerativeModel(model_name)
                    self.model_name = model_name.replace('models/', '')
                    logger.info(f"Using quota-efficient model: {self.model_name}")
                    return
                except Exception:
                    continue
            
            # Fallback: List available models and use the most efficient one
            models = genai.list_models()
            available_models = [
                m.name for m in models 
                if 'generateContent' in m.supported_generation_methods
                and 'flash' in m.name.lower()  # Prefer Flash models
            ]
            
            if available_models:
                self.model_name = available_models[0].replace('models/', '')
                logger.info(f"Using available Flash model: {self.model_name}")
                self.model = genai.GenerativeModel(available_models[0])
            else:
                # Final fallback
                logger.warning("No Flash models found, using standard fallback")
                self.model = genai.GenerativeModel('models/gemini-1.5-flash')
                self.model_name = 'gemini-1.5-flash'
                
        except Exception as e:
            logger.error(f"Model selection failed: {e}")
            # Use fallback model
            self.model = genai.GenerativeModel('models/gemini-1.5-flash')
            self.model_name = 'gemini-1.5-flash'
    
    async def generate_response(self, user_input: str) -> str:
        """Generate response from Gemini AI with quota-efficient approach"""
        try:
            logger.info(f"Generating response for: '{user_input[:30]}...'")
            
            # Create efficient, concise prompt to reduce token usage
            prompt = f"As a voice coach, give brief feedback for: '{user_input[:200]}'"
            
            # Configure generation for efficiency
            generation_config = {
                'temperature': 0.7,
                'top_p': 0.8,
                'top_k': 40,
                'max_output_tokens': 150,  # Limit response length to save quota
            }
            
            # Generate response with configuration
            response = self.model.generate_content(
                prompt,
                generation_config=generation_config
            )
            ai_response = response.text.strip()
            
            logger.info(f"✅ Generated {len(ai_response)} chars with optimized settings")
            logger.debug(f"Response preview: '{ai_response[:50]}...'")
            
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
        # Enhanced mock responses that simulate real coaching feedback
        coaching_templates = [
            f"🎯 **Voice Coaching Feedback (Demo Mode)**\n\n**What I heard**: '{user_input[:100]}...'\n\n**Quick Assessment**: Good clarity and pace! Your message came through clearly.\n\n**Suggestion**: Try varying your tone to emphasize key points. Overall confidence level looks solid!\n\n📊 **Score**: 8.5/10",
            
            f"🎙️ **Pitch Analysis (Offline Mode)**\n\n**Your Input**: '{user_input[:100]}...'\n\n**Strengths**: Clear articulation and good message structure.\n**Areas to improve**: Consider adding more enthusiasm to engage your audience.\n\n✨ **Tip**: Practice emphasizing your value proposition with stronger conviction.\n\n📈 **Rating**: 8.2/10",
            
            f"🚀 **Sales Coach Feedback (Mock)**\n\n**Message**: '{user_input[:100]}...'\n\n**Analysis**: Professional tone detected. Your communication style shows confidence.\n**Coaching**: Add specific examples to make your pitch more compelling.\n\n🎖️ **Achievement Unlocked**: Clear Communication\n📊 **Performance**: 8.7/10"
        ]
        
        response = random.choice(coaching_templates)
        logger.info(f"🎭 Enhanced mock response generated")
        return response
    
    def get_model_info(self) -> dict:
        """Get information about the current model"""
        return {
            "model_name": self.model_name,
            "api_configured": self.model is not None
        }
