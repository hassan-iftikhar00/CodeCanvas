"""
Data Labeling Tool for Sketch Annotations

This tool helps annotate canvas sketches with UI element bounding boxes.
"""

import os
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import tkinter as tk
from tkinter import filedialog, Canvas, Button, Label, Listbox, Entry

class SketchAnnotator:
    def __init__(self, root):
        self.root = root
        self.root.title("CodeCanvas - Sketch Annotator")
        
        self.image_path = None
        self.image = None
        self.annotations = []
        self.current_rect = None
        self.start_x = None
        self.start_y = None
        
        self.element_types = ['button', 'input', 'container', 'text']
        self.current_type = 'button'
        
        self.setup_ui()
    
    def setup_ui(self):
        # Top frame for controls
        control_frame = tk.Frame(self.root)
        control_frame.pack(side=tk.TOP, fill=tk.X, padx=10, pady=10)
        
        Button(control_frame, text="Load Image", command=self.load_image).pack(side=tk.LEFT, padx=5)
        Button(control_frame, text="Save Annotations", command=self.save_annotations).pack(side=tk.LEFT, padx=5)
        Button(control_frame, text="Clear All", command=self.clear_annotations).pack(side=tk.LEFT, padx=5)
        
        # Element type selector
        Label(control_frame, text="Element Type:").pack(side=tk.LEFT, padx=10)
        for et in self.element_types:
            tk.Radiobutton(
                control_frame, 
                text=et.capitalize(), 
                variable=tk.StringVar(value=self.current_type),
                value=et,
                command=lambda t=et: setattr(self, 'current_type', t)
            ).pack(side=tk.LEFT)
        
        # Canvas for drawing
        self.canvas = Canvas(self.root, width=1000, height=600, bg='white')
        self.canvas.pack(padx=10, pady=10)
        
        # Bind mouse events
        self.canvas.bind("<Button-1>", self.on_mouse_down)
        self.canvas.bind("<B1-Motion>", self.on_mouse_drag)
        self.canvas.bind("<ButtonRelease-1>", self.on_mouse_up)
        
        # Annotations list
        list_frame = tk.Frame(self.root)
        list_frame.pack(side=tk.BOTTOM, fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        Label(list_frame, text="Annotations:").pack(side=tk.TOP)
        self.annotations_listbox = Listbox(list_frame, height=10)
        self.annotations_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        Button(list_frame, text="Delete Selected", command=self.delete_annotation).pack(side=tk.RIGHT, padx=5)
    
    def load_image(self):
        file_path = filedialog.askopenfilename(
            title="Select Sketch Image",
            filetypes=[("PNG files", "*.png"), ("All files", "*.*")]
        )
        
        if file_path:
            self.image_path = file_path
            self.image = Image.open(file_path)
            
            # Display image on canvas
            from PIL import ImageTk
            self.photo = ImageTk.PhotoImage(self.image)
            self.canvas.create_image(0, 0, anchor=tk.NW, image=self.photo)
            
            # Try to load existing annotations
            label_path = self.get_label_path()
            if os.path.exists(label_path):
                with open(label_path, 'r') as f:
                    data = json.load(f)
                    self.annotations = data.get('elements', [])
                    self.redraw_annotations()
    
    def get_label_path(self):
        if not self.image_path:
            return None
        
        sketch_name = Path(self.image_path).stem
        labels_dir = Path(__file__).parent.parent / 'datasets' / 'labels'
        labels_dir.mkdir(parents=True, exist_ok=True)
        
        return labels_dir / f"{sketch_name}.json"
    
    def on_mouse_down(self, event):
        self.start_x = event.x
        self.start_y = event.y
        self.current_rect = self.canvas.create_rectangle(
            self.start_x, self.start_y, self.start_x, self.start_y,
            outline='red', width=2
        )
    
    def on_mouse_drag(self, event):
        if self.current_rect:
            self.canvas.coords(
                self.current_rect,
                self.start_x, self.start_y, event.x, event.y
            )
    
    def on_mouse_up(self, event):
        if self.current_rect:
            x1, y1 = min(self.start_x, event.x), min(self.start_y, event.y)
            x2, y2 = max(self.start_x, event.x), max(self.start_y, event.y)
            
            annotation = {
                "type": self.current_type,
                "bounds": {
                    "x": int(x1),
                    "y": int(y1),
                    "width": int(x2 - x1),
                    "height": int(y2 - y1)
                }
            }
            
            self.annotations.append(annotation)
            self.annotations_listbox.insert(tk.END, f"{self.current_type}: ({x1}, {y1}, {x2-x1}, {y2-y1})")
            
            self.current_rect = None
    
    def redraw_annotations(self):
        self.canvas.delete("annotation")
        self.annotations_listbox.delete(0, tk.END)
        
        for ann in self.annotations:
            b = ann['bounds']
            self.canvas.create_rectangle(
                b['x'], b['y'], b['x'] + b['width'], b['y'] + b['height'],
                outline='blue', width=2, tags="annotation"
            )
            self.annotations_listbox.insert(
                tk.END, 
                f"{ann['type']}: ({b['x']}, {b['y']}, {b['width']}, {b['height']})"
            )
    
    def delete_annotation(self):
        selection = self.annotations_listbox.curselection()
        if selection:
            idx = selection[0]
            del self.annotations[idx]
            self.redraw_annotations()
    
    def clear_annotations(self):
        self.annotations = []
        self.redraw_annotations()
    
    def save_annotations(self):
        if not self.image_path:
            return
        
        label_path = self.get_label_path()
        
        data = {
            "image": Path(self.image_path).name,
            "elements": self.annotations
        }
        
        with open(label_path, 'w') as f:
            json.dump(data, f, indent=2)
        
        print(f"Annotations saved to: {label_path}")


if __name__ == "__main__":
    root = tk.Tk()
    app = SketchAnnotator(root)
    root.mainloop()
