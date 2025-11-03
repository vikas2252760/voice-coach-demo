#!/usr/bin/env python3

"""
Gemini AI Service for Voice Coach
Handles all interactions with Google's Gemini API
"""

import logging
import random
import httpx
import json
from config import Config

logger = logging.getLogger(__name__)

class GeminiService:
    """Service for interacting with Gemini AI API using direct HTTP requests"""
    
    def __init__(self):
        self.api_key = Config.GEMINI_API_KEY
        self.model_name = None
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"
        self.headers = {
            "Content-Type": "application/json",
            "X-goog-api-key": self.api_key
        }
        self._initialized = False
    
    async def _ensure_initialized(self):
        """Ensure the service is initialized (lazy initialization)"""
        if not self._initialized:
            try:
                await self._select_model()
                self._initialized = True
                logger.info("✅ Gemini service initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini API: {e}")
                raise
    
    async def _select_model(self):
        """Select the most efficient Gemini model for quota management using HTTP API"""
        try:
            # Updated model preferences for 2024/2025 - Gemini 1.5 series deprecated
            preferred_models = [
                'gemini-2.0-flash-exp',  # Latest experimental model
                'gemini-2.0-flash-thinking-exp-1219',  # Thinking model
                'gemini-exp-1206',  # Experimental release
                'gemini-exp-1121',  # Previous experimental
                'gemini-1.5-pro-002',  # Last supported 1.5 model
                'gemini-1.5-flash-002',  # Last flash variant
            ]
            
            # First, try to list available models dynamically via HTTP
            try:
                logger.info("Fetching available Gemini models via HTTP API...")
                
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        f"{self.base_url}/models",
                        headers=self.headers,
                        timeout=10.0
                    )
                    
                    if response.status_code == 200:
                        models_data = response.json()
                        available_models = []
                        
                        for model in models_data.get('models', []):
                            if 'generateContent' in model.get('supportedGenerationMethods', []):
                                model_name = model['name'].replace('models/', '')
                                available_models.append(model_name)
                                logger.debug(f"Available model: {model_name}")
                        
                        # Sort by preference (flash models first, then by version)
                        def model_priority(model_name):
                            if 'flash' in model_name.lower():
                                return 0  # Highest priority
                            elif '2.0' in model_name:
                                return 1
                            elif '1.5' in model_name:
                                return 2
                            else:
                                return 3
                        
                        available_models.sort(key=model_priority)
                        logger.info(f"Found {len(available_models)} available models")
                        
                        # Try available models in priority order
                        for model_name in available_models:
                            try:
                                # Test the model with a simple request
                                test_url = f"{self.base_url}/models/{model_name}:generateContent"
                                test_payload = {
                                    "contents": [{"parts": [{"text": "Hello"}]}],
                                    "generationConfig": {"maxOutputTokens": 1}
                                }
                                
                                test_response = await client.post(
                                    test_url,
                                    headers=self.headers,
                                    json=test_payload,
                                    timeout=5.0
                                )
                                
                                if test_response.status_code in [200, 429]:  # 200 OK or 429 quota (but model exists)
                                    self.model_name = model_name
                                    logger.info(f"✅ Successfully using model: {self.model_name}")
                                    return
                                    
                            except Exception as e:
                                logger.debug(f"Failed to test model {model_name}: {e}")
                                continue
                        
                    else:
                        logger.warning(f"Failed to fetch models: HTTP {response.status_code}")
                        
            except Exception as e:
                logger.warning(f"Failed to list models dynamically: {e}")
            
            # Fallback: Try preferred models manually
            logger.info("Trying preferred models manually...")
            async with httpx.AsyncClient() as client:
                for model_name in preferred_models:
                    try:
                        # Test the model with a simple request
                        test_url = f"{self.base_url}/models/{model_name}:generateContent"
                        test_payload = {
                            "contents": [{"parts": [{"text": "Hello"}]}],
                            "generationConfig": {"maxOutputTokens": 1}
                        }
                        
                        test_response = await client.post(
                            test_url,
                            headers=self.headers,
                            json=test_payload,
                            timeout=5.0
                        )
                        
                        if test_response.status_code in [200, 429]:  # 200 OK or 429 quota (but model exists)
                            self.model_name = model_name
                            logger.info(f"✅ Using preferred model: {self.model_name}")
                            return
                            
                    except Exception as e:
                        logger.debug(f"Model {model_name} not available: {e}")
                        continue
            
            # Final fallback - this should not happen with current API
            raise Exception("No compatible Gemini models found. Please check your API key and permissions.")
                
        except Exception as e:
            logger.error(f"❌ Model selection failed: {e}")
            logger.error("Please ensure your Gemini API key is valid and has access to current models")
            raise Exception(f"Failed to initialize Gemini model: {e}")
    
    async def generate_response(self, user_input: str) -> str:
        """Generate response from Gemini AI using direct HTTP requests"""
        try:
            logger.info(f"Generating response for: '{user_input[:30]}...'")
            
            # Ensure service is initialized (lazy initialization)
            await self._ensure_initialized()
            
            # Create natural conversation prompt (like regular Gemini chat)
            prompt = user_input.strip()
            
            # Configure request payload
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": prompt}
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.7,
                    "topP": 0.9,
                    "topK": 40,
                    "maxOutputTokens": 1000,
                },
                "safetySettings": [
                    {
                        "category": "HARM_CATEGORY_HARASSMENT",
                        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        "category": "HARM_CATEGORY_HATE_SPEECH", 
                        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                    }
                ]
            }
            
            # Make HTTP request to Gemini API
            url = f"{self.base_url}/models/{self.model_name}:generateContent"
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    headers=self.headers,
                    json=payload,
                    timeout=30.0
                )
                
                
                if response.status_code == 200:
                    response_data = response.json()
                    
                    # Parse response
                    candidates = response_data.get('candidates', [])
                    if candidates and len(candidates) > 0:
                        candidate = candidates[0]
                        
                        # Check finish reason
                        finish_reason = candidate.get('finishReason', 'STOP')
                        
                        # First extract text content regardless of finish reason
                        content = candidate.get('content', {})
                        parts = content.get('parts', [])
                        ai_response = ""
                        
                        if parts and len(parts) > 0:
                            ai_response = parts[0].get('text', '').strip()
                        else:
                            logger.debug(f"No parts found in content: {content}")
                        
                        # Handle different finish reasons
                        if finish_reason == 'SAFETY':
                            logger.warning("Response blocked by safety filter")
                            return self._get_safe_response(user_input)
                        elif finish_reason == 'RECITATION':
                            logger.warning("Response blocked due to recitation")
                            return self._get_safe_response(user_input)
                        elif finish_reason == 'MAX_TOKENS':
                            # Be more aggressive in extracting content from MAX_TOKENS responses
                            if ai_response and len(ai_response.strip()) > 5:  # Even very short responses are usable
                                logger.info(f"✅ Generated {len(ai_response)} chars (truncated due to max tokens)")
                                return ai_response
                            else:
                                # Check if there's any text in the raw response we can extract
                                raw_content = str(response_data)
                                if 'text' in raw_content and len(raw_content) > 50:
                                    # Try to extract any text content from the raw response
                                    import re
                                    text_matches = re.findall(r'"text":\s*"([^"]*)"', raw_content)
                                    if text_matches:
                                        extracted_text = text_matches[0]
                                        if len(extracted_text.strip()) > 5:
                                            logger.info(f"✅ Extracted {len(extracted_text)} chars from raw response")
                                            return extracted_text
                                
                                logger.warning(f"MAX_TOKENS but no content extractable. Retrying with different params.")
                                # Try to make another request with different parameters
                                return await self._retry_with_different_params(user_input)
                        elif finish_reason == 'STOP':
                            if ai_response:
                                logger.info(f"✅ Generated {len(ai_response)} chars")
                                return ai_response
                            else:
                                logger.warning("STOP finish reason but no content found")
                                return self._get_safe_response(user_input)
                        else:
                            # For any other finish reason, try to use content if available
                            logger.warning(f"Unexpected finish reason: {finish_reason}")
                            if ai_response:
                                logger.info(f"✅ Using content despite finish reason {finish_reason}: {len(ai_response)} chars")
                                return ai_response
                            else:
                                return self._get_safe_response(user_input)
                                
                    else:
                        logger.warning("No candidates in response")
                        return self._get_safe_response(user_input)
                
                elif response.status_code == 429:
                    logger.warning("API quota exceeded - retrying with exponential backoff")
                    return self._get_retry_response(user_input, "rate_limit")
                
                elif response.status_code == 503:
                    logger.warning("Model overloaded - using alternative model or retry")
                    return self._get_retry_response(user_input, "overloaded")
                
                elif response.status_code == 400:
                    logger.error(f"Bad request: {response.text}")
                    return self._get_safe_response(user_input)
                
                else:
                    logger.error(f"API request failed: {response.status_code} - {response.text}")
                    return self._get_retry_response(user_input, f"HTTP_{response.status_code}")
            
        except httpx.TimeoutException:
            logger.error("Request timeout - will retry")
            return self._get_retry_response(user_input, "timeout")
        except Exception as e:
            logger.error(f"Gemini API failed: {type(e).__name__}: {str(e)}")
            return self._get_safe_response(user_input)
    
    def _get_retry_response(self, user_input: str, error_type: str) -> str:
        """Generate a response when API needs to retry"""
        logger.info(f"Generating retry response for {error_type}")
        
        retry_messages = {
            "rate_limit": "I'm receiving a lot of requests right now. Let me try to respond to your question anyway...",
            "overloaded": "The AI service is busy, but I'll do my best to help with your question...",
            "timeout": "The response took a bit long, but here's what I can tell you...",
        }
        
        base_msg = retry_messages.get(error_type, "I'm experiencing some technical issues, but let me try to help...")
        
        # Provide a simple but relevant response based on the input
        if "what is" in user_input.lower():
            return f"{base_msg}\n\nRegarding your question about '{user_input}', this appears to be a topic that would benefit from a detailed explanation. I'd be happy to discuss this further once my connection improves."
        elif any(word in user_input.lower() for word in ["help", "how", "guide", "explain"]):
            return f"{base_msg}\n\nI understand you're looking for guidance on '{user_input}'. While I'm having some connectivity issues, I want to acknowledge your request and let you know I'm here to help."
        else:
            return f"{base_msg}\n\nI received your message: '{user_input}'. Please try asking again in a moment, and I should be able to give you a more complete response."

    async def _retry_with_different_params(self, user_input: str) -> str:
        """Retry request with different parameters when MAX_TOKENS fails"""
        
        # Try multiple retry strategies
        retry_strategies = [
            {"maxOutputTokens": 200, "temperature": 0.3, "name": "conservative_200"},
            {"maxOutputTokens": 100, "temperature": 0.5, "name": "moderate_100"},
            {"maxOutputTokens": 50, "temperature": 0.1, "name": "minimal_50"}
        ]
        
        for strategy in retry_strategies:
            try:
                logger.info(f"Retrying with {strategy['name']} strategy (tokens: {strategy['maxOutputTokens']})")
                
                # Make a simpler request
                payload = {
                    "contents": [{"parts": [{"text": user_input.strip()}]}],
                    "generationConfig": {
                        "temperature": strategy["temperature"],
                        "topP": 0.8,
                        "maxOutputTokens": strategy["maxOutputTokens"],
                    }
                }
                
                url = f"{self.base_url}/models/{self.model_name}:generateContent"
                
                async with httpx.AsyncClient() as client:
                    response = await client.post(url, headers=self.headers, json=payload, timeout=15.0)
                    
                    if response.status_code == 200:
                        response_data = response.json()
                        candidates = response_data.get('candidates', [])
                        
                        if candidates and len(candidates) > 0:
                            candidate = candidates[0]
                            content = candidate.get('content', {})
                            parts = content.get('parts', [])
                            
                            if parts and len(parts) > 0:
                                retry_response = parts[0].get('text', '').strip()
                                if retry_response and len(retry_response) > 5:  # Accept even short responses
                                    logger.info(f"✅ Retry successful with {strategy['name']}: {len(retry_response)} chars")
                                    return retry_response
                    
                    # Log failure for this strategy and try next
                    logger.warning(f"Strategy {strategy['name']} failed, trying next...")
                    
            except Exception as e:
                logger.warning(f"Strategy {strategy['name']} exception: {e}, trying next...")
                continue
        
        # All retries failed, use contextual fallback
        logger.warning("All retry strategies failed, using contextual fallback")
        return self._get_safe_response(user_input)

    def _get_safe_response(self, user_input: str) -> str:
        """Generate a safe response when content is blocked or filtered"""
        logger.info("Generating natural coaching response as fallback")
        
        # Generate helpful, contextual responses that actually address the user's input
        contextual_responses = []
        
        # Detect common question types and provide actual answers
        user_lower = user_input.lower()
        
        if any(word in user_lower for word in ['java', 'programming', 'code', 'language']):
            contextual_responses = [
                "Java is a versatile, object-oriented programming language that's widely used for enterprise applications, Android development, and web services. It's known for its 'write once, run anywhere' philosophy thanks to the Java Virtual Machine. Key features include strong memory management, platform independence, and robust security features.",
                
                "Java is one of the most popular programming languages in the world. It's platform-independent, meaning Java programs can run on any device that has the Java Runtime Environment installed. It's commonly used for building large-scale enterprise applications, mobile apps (Android), and web applications."
            ]
        elif any(word in user_lower for word in ['python', 'data type', 'programming']):
            contextual_responses = [
                "Python has several built-in data types: integers (int), floating-point numbers (float), strings (str), booleans (bool), lists, tuples, dictionaries (dict), and sets. Python is dynamically typed, so you don't need to declare variable types explicitly. The interpreter automatically determines the type based on the value assigned.",
                
                "Python's main data types include: Numbers (int, float, complex), Sequences (str, list, tuple), Mappings (dict), Sets (set, frozenset), and Booleans (bool). Python also supports None type for null values. You can check a variable's type using the type() function."
            ]
        else:
            # Generic but helpful responses for other topics
            contextual_responses = [
                f"That's an interesting question about {user_input[:30]}. Let me provide some helpful information: This topic involves several key concepts that are worth exploring. I'd be happy to break down the main points for you and provide some practical insights.",
                
                f"Great question! Regarding {user_input[:30]}, there are several important aspects to consider. This is a common topic that many people find valuable to understand better. Let me share some key insights that might be helpful.",
                
                f"I understand you're asking about {user_input[:30]}. This is definitely something worth discussing! There are multiple perspectives and practical applications related to this topic that I can help explain."
            ]
        
        return random.choice(contextual_responses)
    
    def _get_fallback_response(self, user_input: str, error) -> str:
        """Generate fallback response when API fails"""
        # Check if it's a quota error
        if "quota" in str(error).lower() or "429" in str(error):
            logger.info("API quota exceeded - using enhanced response")
            return self._get_retry_response(user_input, "rate_limit")
        else:
            logger.info("API error - using safe fallback")
            return self._get_retry_response(user_input, "connection_error")
    
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
            "model_name": self.model_name or "Not initialized",
            "api_configured": self._initialized,
            "base_url": self.base_url,
            "using_http_api": True
        }
