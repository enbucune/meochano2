# AI Motion Studio v0.2
Upload all files to a GitHub repository root. Settings > Pages > Deploy from a branch > main / root. Open the Pages URL. Requires internet for Three.js CDN. Local testing: `python3 -m http.server 8000` then open http://localhost:8000.
## AI contract
Edit project.json, not engine.js for new motions. Coordinates meters, Y up, angles degrees, times seconds, local Euler XYZ. characters: id, position, yaw, color. objects: position, size, color (boxes). tracks: actor, joint, axis (x/y/z), keys [[seconds,degrees], ...] sorted ascending. Smoothstep interpolation. Use UI joint list for exact joint names. Export JSON to preserve edits. Add characters by copying a character with a unique id. Camera is independent. No server or credentials required.
## Limitations
Prototype: FK only, no IK, collision solver, anatomical constraints, root motion tracks or automatic balance. Video records viewport in real time; browser codec support varies. No tested Mac RAM benchmark. Finger and toe joints are simplified, not anatomical rig. No direct Gemini/Claude API integration. Browser execution not tested in this environment.
