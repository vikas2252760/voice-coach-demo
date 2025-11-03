#!/usr/bin/env python3

"""
Test script to validate Gemini API connection
Run this script to test if your API key and connection are working
"""

import os
import sys
import logging
from dotenv import load_dotenv

# Add current directory to path to import local modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

async def test_gemini_connection():
    """Test Gemini API connection and model availability"""
    
    print("🧪 Testing Gemini API Connection...")
    print("=" * 50)
    
    # Load environment variables
    load_dotenv()
    
    # Check API key
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "YOUR_ACTUAL_API_KEY_HERE":
        print("❌ ERROR: GEMINI_API_KEY not found or not set!")
        print("   Please add your real Gemini API key to the .env file")
        print("   Get your API key at: https://ai.google.dev/")
        return False
    
    print(f"✅ API Key found: {api_key[:8]}...{api_key[-4:]}")
    
    # Test GeminiService
    try:
        from gemini_service import GeminiService
        
        print("🔌 Initializing Gemini Service...")
        service = GeminiService()
        
        # Test a simple API call (this will trigger lazy initialization)
        print("🤖 Testing API call with HTTP headers...")
        print(f"   Headers: Content-Type: application/json")
        print(f"   Headers: X-goog-api-key: {service.api_key[:8]}...{service.api_key[-4:]}")
        
        test_response = await service.generate_response("Hello, this is a test message.")
        
        # Get model info after initialization
        model_info = service.get_model_info()
        print(f"✅ Model initialized: {model_info['model_name']}")
        
        if test_response and len(test_response) > 10:
            print("✅ API call successful!")
            print(f"   Response length: {len(test_response)} characters")
            print(f"   Response preview: {test_response[:100]}...")
            return True
        else:
            print("❌ API call returned empty or invalid response")
            return False
            
    except Exception as e:
        print(f"❌ Connection test failed: {e}")
        logger.error(f"Full error: {e}", exc_info=True)
        return False

async def main():
    """Main async function to run the test"""
    try:
        success = await test_gemini_connection()
        if success:
            print("\n🎉 SUCCESS: Gemini API is connected and working!")
            print("   You can now start the Voice Coach server")
        else:
            print("\n💥 FAILED: Please fix the issues above and try again")
        
        print(f"\n📝 Next steps:")
        if not success:
            print("   1. Add your real Gemini API key to .env file")
            print("   2. Run this test script again: python test_gemini_connection.py")
        print("   3. Start the server: python voice_coach_server.py")
        
    except KeyboardInterrupt:
        print("\n🛑 Test interrupted by user")
    except Exception as e:
        print(f"\n💥 Unexpected error: {e}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
