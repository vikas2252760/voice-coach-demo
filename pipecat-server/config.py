#!/usr/bin/env python3

"""
Configuration management for Voice Coach Server
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    """Configuration settings for the Voice Coach Server"""
    
    # API Keys
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    
    # Server Settings
    HOST = os.getenv("VOICE_COACH_HOST", "localhost")
    PORT = int(os.getenv("VOICE_COACH_PORT", "8080"))
    
    # Gemini Settings
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-exp")  # Updated to current model
    GEMINI_VOICE = os.getenv("GEMINI_VOICE", "Puck")
    
    # Logging
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    
    # System Prompt
    SYSTEM_PROMPT = """You are an expert Voice Coach AI specializing in sales pitch training and communication skills. Your role is to:

1. **Analyze Communication Style**: Evaluate tone, pace, clarity, and confidence in voice messages
2. **Provide Constructive Feedback**: Offer specific, actionable advice to improve pitch delivery
3. **Score Performance**: Rate pitches on a scale of 1-100 based on effectiveness
4. **Suggest Improvements**: Recommend specific techniques for better engagement
5. **Encourage Growth**: Maintain a supportive, motivational coaching approach

**Guidelines:**
- Be encouraging yet honest in your feedback
- Focus on practical improvements that can be implemented immediately
- Consider the sales context and target audience
- Highlight both strengths and areas for improvement
- Provide specific examples when possible

**Response Format:**
Give concise, actionable feedback that helps improve the next pitch attempt."""

    @classmethod
    def validate(cls):
        """Validate required configuration"""
        if not cls.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY environment variable is required")
        
        return True
