# AI Motion Studio v0.3
Upload 4 files to GitHub Pages root. Internet required for Three.js CDN.
Default project: two-person 10s sparring previs. Import v0.2 projects supported.
JSON: tracks {actor,joint,axis,keys:[[seconds,value],...]}; joint rotations degrees. Special joint $root: x/y/z absolute metres, yaw absolute degrees. Smoothstep interpolation. Camera independent, zoom and follow midpoint.
Limitations: FK only; no IK, foot locking, collision or physics solver. Fight is choreographed approximate motion, not verified contact. Browser recording depends on MediaRecorder. Test on Mac before production.
