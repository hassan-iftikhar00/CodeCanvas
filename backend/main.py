from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
from dotenv import load_dotenv

# Import our custom modules
from app.supabase_client import get_supabase_client
from app.models.inference import SketchDetector, CodeGenerator
from app.utils.preprocessing import preprocess_canvas_data, normalize_coordinates

# Load environment variables
load_dotenv()

app = FastAPI(
    title="CodeCanvas AI Backend",
    description="Custom AI models for sketch-to-code generation",
    version="1.0.0"
)

# CORS middleware for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        os.getenv("FRONTEND_URL", "http://localhost:3000")
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response Models
class CanvasData(BaseModel):
    strokes: Optional[List[List[Dict[str, float]]]] = None
    lines: Optional[List[Dict[str, Any]]] = None
    width: int = 1000
    height: int = 600

class GenerateCodeRequest(BaseModel):
    canvasData: CanvasData
    framework: str = "react"
    description: Optional[str] = None
    projectId: str
    userId: str

class DetectedElement(BaseModel):
    type: str
    confidence: float
    bounds: Dict[str, float]
    label: Optional[str] = None

class GenerateCodeResponse(BaseModel):
    code: str
    success: bool
    elements: List[DetectedElement]
    iteration_id: Optional[str] = None

# Initialize AI models (loaded once at startup)
sketch_detector = None
code_generator = None

@app.on_event("startup")
async def load_models():
    """Load trained models on server startup"""
    global sketch_detector, code_generator
    print("🚀 Loading AI models...")
    
    try:
        sketch_detector = SketchDetector()
        code_generator = CodeGenerator()
        print("✅ Models loaded successfully!")
    except Exception as e:
        print(f"⚠️ Warning: Could not load models: {e}")
        print("📝 Running in development mode with mock predictions")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "service": "CodeCanvas AI Backend",
        "models_loaded": sketch_detector is not None and code_generator is not None
    }

@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "sketch_detector": "loaded" if sketch_detector else "not loaded",
        "code_generator": "loaded" if code_generator else "not loaded",
    }

@app.post("/api/predict", response_model=GenerateCodeResponse)
async def predict(request: GenerateCodeRequest):
    """
    Main endpoint for sketch-to-code generation using custom trained models
    
    This is your FYP AI pipeline:
    1. Preprocess canvas data
    2. Run custom CNN for element detection
    3. Run custom code generation model
    4. Save results to Supabase
    5. Return generated code
    """
    try:
        print(f"📥 Received prediction request for project: {request.projectId}")
        
        # Step 1: Validate user authentication via Supabase
        supabase = get_supabase_client()
        
        # Verify user exists and owns the project
        project_result = supabase.table("projects")\
            .select("*")\
            .eq("id", request.projectId)\
            .eq("user_id", request.userId)\
            .execute()
        
        if not project_result.data:
            raise HTTPException(status_code=403, detail="Project not found or unauthorized")
        
        # Step 2: Preprocess canvas data for AI models
        processed_data = preprocess_canvas_data(
            request.canvasData.dict(),
            target_size=(256, 256)  # Resize for CNN input
        )
        
        # Step 3: Run custom CNN for sketch element detection
        if sketch_detector:
            detected_elements = sketch_detector.detect(processed_data)
        else:
            # Development fallback - mock predictions
            detected_elements = [
                {
                    "type": "button",
                    "confidence": 0.92,
                    "bounds": {"x": 100, "y": 50, "width": 120, "height": 40},
                    "label": "Submit Button"
                },
                {
                    "type": "input",
                    "confidence": 0.88,
                    "bounds": {"x": 100, "y": 100, "width": 200, "height": 35},
                    "label": "Email Input"
                }
            ]
        
        print(f"🔍 Detected {len(detected_elements)} UI elements")
        
        # Step 4: Run custom code generation model
        if code_generator:
            generated_code = code_generator.generate(
                elements=detected_elements,
                framework=request.framework,
                description=request.description
            )
        else:
            # Development fallback - template-based code
            generated_code = generate_fallback_code(
                detected_elements,
                request.framework
            )
        
        print(f"💻 Generated {len(generated_code)} characters of code")
        
        # Step 5: Save iteration to database
        iteration_data = {
            "project_id": request.projectId,
            "canvas_data": request.canvasData.dict(),
            "generated_code": generated_code,
            "prompt_used": request.description,
        }
        
        iteration_result = supabase.table("iterations")\
            .insert(iteration_data)\
            .execute()
        
        iteration_id = iteration_result.data[0]["id"] if iteration_result.data else None
        
        # Step 6: Update project with latest code
        supabase.table("projects")\
            .update({
                "generated_code": generated_code,
                "canvas_data": request.canvasData.dict(),
            })\
            .eq("id", request.projectId)\
            .execute()
        
        print("✅ Results saved to database")
        
        return GenerateCodeResponse(
            code=generated_code,
            success=True,
            elements=[DetectedElement(**elem) for elem in detected_elements],
            iteration_id=iteration_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in prediction pipeline: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

def generate_fallback_code(elements: List[Dict], framework: str) -> str:
    """
    Template-based code generation fallback
    Used during development before custom model is trained
    """
    if framework == "react":
        code = "export default function GeneratedComponent() {\n  return (\n    <div className=\"flex flex-col gap-4 p-6\">\n"
        
        for elem in elements:
            if elem["type"] == "button":
                code += f"      <button className=\"rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700\">\n        {elem.get('label', 'Button')}\n      </button>\n"
            elif elem["type"] == "input":
                code += f"      <input\n        type=\"text\"\n        placeholder=\"{elem.get('label', 'Enter text')}\"\n        className=\"rounded-lg border border-gray-300 px-4 py-2\"\n      />\n"
        
        code += "    </div>\n  );\n}"
        return code
    
    return "<div>Unsupported framework</div>"

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
