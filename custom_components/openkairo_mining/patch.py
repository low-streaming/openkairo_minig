import logging
import subprocess
import sys
from importlib.util import find_spec

_LOGGER = logging.getLogger(__name__)

def install_package(package: str):
    """Install a package using pip or uv."""
    _LOGGER.info(f"Attempting to install package: {package}")
    
    # Try using uv first (faster and better resolver)
    try:
        args = [
            sys.executable,
            "-m",
            "uv",
            "pip",
            "install",
            "--prerelease=allow",
            package,
        ]
        subprocess.check_call(args)
        _LOGGER.info(f"Successfully installed {package} via uv")
        return True
    except Exception:
        _LOGGER.debug(f"uv install failed for {package}, trying pip")

    # Fallback to pip
    try:
        args = [
            sys.executable,
            "-m",
            "pip",
            "install",
            "--upgrade",
            package,
        ]
        subprocess.check_call(args)
        _LOGGER.info(f"Successfully installed {package} via pip")
        return True
    except Exception as e:
        _LOGGER.error(f"Failed to install {package}: {e}")
        return False

def ensure_pyasic(version: str = "0.78.8"):
    """Ensure pyasic is installed and correct version is loaded."""
    current_spec = find_spec("pyasic")
    
    if current_spec is None:
        _LOGGER.info("pyasic not found, installing...")
        install_package(f"pyasic=={version}")
        _clear_pyasic_modules()
    else:
        # Check if we can import it
        try:
            import pyasic
            if pyasic.__version__ != version:
                _LOGGER.info(f"pyasic version mismatch (found {pyasic.__version__}, need {version}), re-installing...")
                install_package(f"pyasic=={version}")
                _clear_pyasic_modules()
        except Exception:
            _LOGGER.warning("pyasic import failed even though spec exists, fixing installation...")
            install_package(f"pyasic=={version}")
            _clear_pyasic_modules()

def _clear_pyasic_modules():
    """Clear pyasic from sys.modules to force reload."""
    _LOGGER.info("Clearing pyasic modules from cache")
    for key in list(sys.modules.keys()):
        if key == "pyasic" or key.startswith("pyasic."):
            del sys.modules[key]
