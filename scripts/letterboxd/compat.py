"""
Compatibility shim for Python 3.9 and letterboxdpy
This patches typing to include TypeAlias for older Python versions
"""
from __future__ import annotations  # Enable postponed evaluation of annotations (Python 3.7+)
import sys
import typing

# Python 3.9 compatibility: TypeAlias was added in Python 3.10
if sys.version_info < (3, 10):
    try:
        from typing_extensions import TypeAlias
        # Monkey patch typing module to include TypeAlias BEFORE any letterboxdpy imports
        if not hasattr(typing, 'TypeAlias'):
            typing.TypeAlias = TypeAlias
            # Also patch __all__ if it exists
            if hasattr(typing, '__all__') and 'TypeAlias' not in typing.__all__:
                typing.__all__ = list(typing.__all__) + ['TypeAlias']
    except ImportError:
        # Fallback: create a simple type alias
        if not hasattr(typing, 'TypeAlias'):
            typing.TypeAlias = type

# Import this module before importing letterboxdpy
# Usage: import scripts.letterboxd.compat before importing letterboxdpy

