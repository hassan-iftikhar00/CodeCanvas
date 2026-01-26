import os
import numpy as np
from typing import List, Dict, Any

class SketchDetector:
    """
    Custom CNN model for detecting UI elements from sketches
    
    TODO for FYP:
    - Train CNN on labeled sketch dataset
    - Architecture: Conv2D layers -> MaxPooling -> Dense -> Softmax
    - Output: Element type + bounding box coordinates
    - Classes: button, input, text, image, container, etc.
    """
    
    def __init__(self, model_path: str = None):
        """
        Initialize the sketch detection model
        
        Args:
            model_path: Path to trained .h5 or .pth model file
        """
        self.model = None
        self.model_path = model_path or os.getenv("SKETCH_MODEL_PATH", "models/sketch_detector.h5")
        
        # Try to load pre-trained model
        if os.path.exists(self.model_path):
            self._load_model()
        else:
            print(f"⚠️ Model not found at {self.model_path}")
            print("📝 Using fallback detection logic")
    
    def _load_model(self):
        """Load trained TensorFlow/PyTorch model"""
        try:
            # For TensorFlow:
            import tensorflow as tf
            self.model = tf.keras.models.load_model(self.model_path)
            print(f"✅ Loaded sketch detector model from {self.model_path}")
            
            # For PyTorch (alternative):
            # import torch
            # self.model = torch.load(self.model_path)
            # self.model.eval()
            
        except Exception as e:
            print(f"❌ Error loading model: {e}")
            self.model = None
    
    def detect(self, preprocessed_image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detect UI elements from preprocessed canvas image
        
        Args:
            preprocessed_image: Normalized image array from preprocessing.py
        
        Returns:
            List of detected elements with type, confidence, and bounds
        """
        if self.model is not None:
            # TODO: Implement actual model inference
            # predictions = self.model.predict(np.expand_dims(preprocessed_image, axis=0))
            # elements = self._postprocess_predictions(predictions)
            # return elements
            pass
        
        # Fallback: Simple heuristic-based detection for development
        return self._fallback_detection(preprocessed_image)
    
    def _fallback_detection(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Simple contour-based detection as fallback before model is trained
        This is just for development - replace with your trained CNN!
        """
        import cv2
        
        # Convert to grayscale
        if len(image.shape) == 3:
            gray = cv2.cvtColor((image * 255).astype(np.uint8), cv2.COLOR_RGB2GRAY)
        else:
            gray = (image * 255).astype(np.uint8)
        
        # Find contours
        _, thresh = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        elements = []
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < 100:  # Filter small noise
                continue
            
            x, y, w, h = cv2.boundingRect(contour)
            aspect_ratio = w / h if h > 0 else 1
            
            # Simple heuristic classification
            if 0.3 <= aspect_ratio <= 0.7 and area < 5000:
                elem_type = "button"
            elif aspect_ratio > 3 and h < 50:
                elem_type = "input"
            elif aspect_ratio > 1.5:
                elem_type = "container"
            else:
                elem_type = "text"
            
            elements.append({
                "type": elem_type,
                "confidence": 0.75,  # Placeholder confidence
                "bounds": {"x": float(x), "y": float(y), "width": float(w), "height": float(h)},
                "label": f"{elem_type.capitalize()}"
            })
        
        return elements


class CodeGenerator:
    """
    Custom model for generating code from detected UI elements
    
    TODO for FYP:
    - Option 1: Template-based system with rules
    - Option 2: Seq2Seq model (LSTM encoder-decoder)
    - Option 3: Fine-tuned small transformer (T5, CodeBERT)
    - Input: Detected elements + user description
    - Output: React/HTML/Vue code
    """
    
    def __init__(self, model_path: str = None):
        """Initialize code generation model"""
        self.model = None
        self.model_path = model_path or os.getenv("CODE_GEN_MODEL_PATH", "models/code_generator.h5")
        
        if os.path.exists(self.model_path):
            self._load_model()
        else:
            print(f"⚠️ Code gen model not found at {self.model_path}")
            print("📝 Using template-based generation")
    
    def _load_model(self):
        """Load trained code generation model"""
        try:
            # Load your custom model here
            # For Seq2Seq or Transformer-based models
            pass
        except Exception as e:
            print(f"❌ Error loading code gen model: {e}")
            self.model = None
    
    def generate(self, elements: List[Dict], framework: str, description: str = None) -> str:
        """
        Generate code from detected elements
        
        Args:
            elements: List of detected UI elements
            framework: Target framework (react, vue, html, etc.)
            description: Optional user description for context
        
        Returns:
            Generated code as string
        """
        if self.model is not None:
            # TODO: Implement model-based generation
            pass
        
        # Fallback: Template-based generation
        return self._template_based_generation(elements, framework, description)
    
    def _template_based_generation(self, elements: List[Dict], framework: str, description: str) -> str:
        """
        Template-based code generation
        This is a reasonable FYP approach if you focus CNN training on sketch detection
        """
        if framework == "react":
            return self._generate_react(elements, description)
        elif framework == "html":
            return self._generate_html(elements, description)
        elif framework == "vue":
            return self._generate_vue(elements, description)
        else:
            return self._generate_react(elements, description)
    
    def _generate_react(self, elements: List[Dict], description: str) -> str:
        """Generate React component code"""
        # Sort elements by Y position (top to bottom)
        sorted_elements = sorted(elements, key=lambda e: e['bounds']['y'])
        
        code = "export default function GeneratedComponent() {\n"
        code += "  return (\n"
        code += "    <div className=\"flex flex-col gap-4 p-8 max-w-md mx-auto\">\n"
        
        if description:
            code += f"      {/* {description} */}\n"
        
        for elem in sorted_elements:
            elem_type = elem.get('type', 'div')
            label = elem.get('label', elem_type.capitalize())
            
            if elem_type == 'button':
                code += f"      <button className=\"rounded-lg bg-blue-600 px-6 py-3 text-white font-semibold hover:bg-blue-700 transition-colors\">\n"
                code += f"        {label}\n"
                code += f"      </button>\n"
            
            elif elem_type == 'input':
                code += f"      <input\n"
                code += f"        type=\"text\"\n"
                code += f"        placeholder=\"{label}\"\n"
                code += f"        className=\"rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none\"\n"
                code += f"      />\n"
            
            elif elem_type == 'text':
                code += f"      <p className=\"text-gray-700\">{label}</p>\n"
            
            elif elem_type == 'container':
                code += f"      <div className=\"rounded-lg border border-gray-200 p-4\">\n"
                code += f"        {/* Container content */}\n"
                code += f"      </div>\n"
        
        code += "    </div>\n"
        code += "  );\n"
        code += "}"
        
        return code
    
    def _generate_html(self, elements: List[Dict], description: str) -> str:
        """Generate HTML code"""
        sorted_elements = sorted(elements, key=lambda e: e['bounds']['y'])
        
        code = "<!DOCTYPE html>\n<html>\n<head>\n"
        code += "  <title>Generated UI</title>\n"
        code += "  <script src=\"https://cdn.tailwindcss.com\"></script>\n"
        code += "</head>\n<body>\n"
        code += "  <div class=\"flex flex-col gap-4 p-8 max-w-md mx-auto\">\n"
        
        for elem in sorted_elements:
            elem_type = elem.get('type', 'div')
            label = elem.get('label', elem_type.capitalize())
            
            if elem_type == 'button':
                code += f"    <button class=\"rounded-lg bg-blue-600 px-6 py-3 text-white font-semibold hover:bg-blue-700\">{label}</button>\n"
            elif elem_type == 'input':
                code += f"    <input type=\"text\" placeholder=\"{label}\" class=\"rounded-lg border border-gray-300 px-4 py-2\" />\n"
            elif elem_type == 'text':
                code += f"    <p class=\"text-gray-700\">{label}</p>\n"
        
        code += "  </div>\n</body>\n</html>"
        return code
    
    def _generate_vue(self, elements: List[Dict], description: str) -> str:
        """Generate Vue component code"""
        code = "<template>\n"
        code += "  <div class=\"flex flex-col gap-4 p-8 max-w-md mx-auto\">\n"
        
        sorted_elements = sorted(elements, key=lambda e: e['bounds']['y'])
        
        for elem in sorted_elements:
            elem_type = elem.get('type', 'div')
            label = elem.get('label', elem_type.capitalize())
            
            if elem_type == 'button':
                code += f"    <button class=\"rounded-lg bg-blue-600 px-6 py-3 text-white font-semibold hover:bg-blue-700\">{label}</button>\n"
            elif elem_type == 'input':
                code += f"    <input type=\"text\" placeholder=\"{label}\" class=\"rounded-lg border border-gray-300 px-4 py-2\" />\n"
        
        code += "  </div>\n</template>\n\n"
        code += "<script>\nexport default {\n  name: 'GeneratedComponent'\n}\n</script>"
        
        return code
