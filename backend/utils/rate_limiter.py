"""
Rate limiting utility for AEGIS API.
"""

from datetime import datetime, timedelta
from typing import Dict
from collections import defaultdict
import threading


class RateLimiter:
    """Simple in-memory rate limiter using sliding window."""
    
    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        """
        Initialize rate limiter.
        
        Args:
            max_requests: Maximum requests per window
            window_seconds: Time window in seconds
        """
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: Dict[str, list] = defaultdict(list)
        self.lock = threading.Lock()
    
    def is_allowed(self, identifier: str) -> bool:
        """
        Check if request is allowed for identifier.
        
        Args:
            identifier: Client identifier (IP, user ID, etc.)
            
        Returns:
            True if request is allowed, False otherwise
        """
        with self.lock:
            now = datetime.now()
            cutoff = now - timedelta(seconds=self.window_seconds)
            
            # Remove old requests
            self.requests[identifier] = [
                req_time for req_time in self.requests[identifier]
                if req_time > cutoff
            ]
            
            # Check limit
            if len(self.requests[identifier]) >= self.max_requests:
                return False
            
            # Add new request
            self.requests[identifier].append(now)
            return True
    
    def reset(self, identifier: str = None):
        """Reset rate limiter."""
        with self.lock:
            if identifier:
                self.requests[identifier] = []
            else:
                self.requests.clear()


# Global rate limiter instance
api_limiter = RateLimiter(max_requests=100, window_seconds=60)
