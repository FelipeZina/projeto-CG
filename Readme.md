# 🐸 Crossy Road 3D - WebGL



## 📖 About the Project

This project is a 3D reinterpretation of the classic arcade game *Crossy Road*, developed entirely in **pure WebGL** (without high-level libraries like Three.js or Babylon.js).

The main goal was to demonstrate mastery of the graphics pipeline, including shader implementation (GLSL), matrix mathematics, and rendering techniques, as required by the **Computer Graphics** course taught by **Prof. Dr. Ana Luisa Dine Martins Lemos**.

## 🎮 Game Features

* **Endless Procedural Terrain:** The map generates infinite lanes of grass, roads, and rivers as the player moves forward.
* **Complex 3D Models:**
    * **Voxel-based Vehicles:** Cars are generated procedurally using code-defined geometry (Voxels) with per-vertex coloring.
    * **OBJ Parsing:** Support for loading external `.obj` models (Frog character, trees, rocks).
* **Dual Camera System:** Switch seamlessly between:
    1.  **Froggy View:** Third-person rear view.
    2.  **Classic View:** Isometric/Orthogonal style similar to the original game.
* **Advanced Lighting:** Implementation of the Phong reflection model with **multiple directional light sources** (Sunlight + Fill Light) to create depth and volume.
* **Textures & Materials:** Hybrid rendering supporting both solid vertex colors and UV-mapped textures (`.jpg` images for terrain).
* **Game Mechanics:**
    * **Collision Detection:** Precise hitboxes for cars and static obstacles.
    * **"The Log":** A giant rolling log chases the player to prevent camping.
    * **Power-Ups:** Shield 🛡️, Speed Boost ⚡, and Time Freeze ⏳.

## 🕹️ Controls

| Key | Action |
| :--- | :--- |
| **W / Up Arrow** | Move Forward |
| **S / Down Arrow** | Move Backward |
| **A / Left Arrow** | Move Left |
| **D / Right Arrow** | Move Right |
| **Button on UI** | Toggle Camera Mode |

## 🚀 How to Run

Since this project loads external textures and models, **you cannot simply open the HTML file** due to browser CORS (Cross-Origin Resource Sharing) security policies.

### Option 1: VS Code (Recommended)
1.  Install the **Live Server** extension by Ritwick Dey.
2.  Right-click `cod.html` and select **"Open with Live Server"**.

### Option 2: Python
If you have Python installed, run this in the project folder:
```bash
# Python 3
python -m http.server
