const vertexShaderSource = `
    attribute vec3 a_position;
    attribute vec3 a_normal;
    
    varying vec3 v_normal;
    varying vec3 v_surfaceToLight;
    varying vec3 v_surfaceToView;
    
    uniform mat4 u_modelMatrix;
    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;
    uniform mat4 u_worldInverseTranspose;
    uniform vec3 u_lightPosition;
    uniform vec3 u_viewPosition;

    void main() {
        vec4 worldPosition = u_modelMatrix * vec4(a_position, 1.0);
        gl_Position = u_projectionMatrix * u_viewMatrix * worldPosition;
        
        v_normal = mat3(u_worldInverseTranspose) * a_normal;
        v_surfaceToLight = u_lightPosition - worldPosition.xyz;
        v_surfaceToView = u_viewPosition - worldPosition.xyz;
    }
`;

const fragmentShaderSource = `
    precision mediump float;
    uniform vec3 u_color;
    varying vec3 v_normal;
    varying vec3 v_surfaceToLight;
    varying vec3 v_surfaceToView;
    
    void main() {
        vec3 normal = normalize(v_normal);
        vec3 surfaceToLight = normalize(v_surfaceToLight);
        vec3 surfaceToView = normalize(v_surfaceToView);
        vec3 halfVector = normalize(surfaceToLight + surfaceToView);

        float light = max(dot(normal, surfaceToLight), 0.0);
        float specular = 0.0;
        if (light > 0.0) {
            specular = pow(max(dot(normal, halfVector), 0.0), 50.0);
        }

        gl_FragColor = vec4(u_color * (0.4 + 0.6 * light) + (specular * 0.2), 1.0);
    }
`;

function parseOBJ(text) {
  const positions = [];
  const normals = [];
  const indices = [];
  const tempVertices = [];
  const tempNormals = [];

  const lines = text.split('\n');
  for (let line of lines) {
    line = line.trim();
    if (line.startsWith('#') || line === '') continue;
    const parts = line.split(/\s+/);
    const keyword = parts[0];
    const args = parts.slice(1);

    if (keyword === 'v') {
      tempVertices.push(args.map(parseFloat));
    } else if (keyword === 'vn') {
      tempNormals.push(args.map(parseFloat));
    } else if (keyword === 'f') {
      const faceVerts = args.map(f => {
        const parts = f.split('/');
        const v = parseInt(parts[0]) - 1;
        const n = parts.length > 2 && parts[2] ? parseInt(parts[2]) - 1 : undefined;
        return { v, n };
      });
      for (let i = 1; i < faceVerts.length - 1; i++) {
        const tri = [faceVerts[0], faceVerts[i], faceVerts[i + 1]];
        tri.forEach(({ v, n }) => {
          const vert = tempVertices[v];
          const norm = n !== undefined ? tempNormals[n] : [0, 1, 0];
          positions.push(...vert);
          normals.push(...norm);
          indices.push(indices.length);
        });
      }
    }
  }
  return { positions, normals, indices };
}
const Matrix = {
    copy: function(m) { return m.slice(); },

    identity: function() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; },
    perspective: function(fovRad, aspect, near, far) {
        const f = Math.tan(Math.PI * 0.5 - 0.5 * fovRad);
        const rangeInv = 1.0 / (near - far);
        return [ f/aspect,0,0,0, 0,f,0,0, 0,0,(near+far)*rangeInv,-1, 0,0,near*far*rangeInv*2,0 ];
    },
    lookAt: function(cameraPosition, target, up) {
        const zAxis = normalize(subtractVectors(cameraPosition, target));
        const xAxis = normalize(cross(up, zAxis));
        const yAxis = normalize(cross(zAxis, xAxis));
        return [
            xAxis[0], yAxis[0], zAxis[0], 0,
            xAxis[1], yAxis[1], zAxis[1], 0,
            xAxis[2], yAxis[2], zAxis[2], 0,
            -(xAxis[0]*cameraPosition[0] + xAxis[1]*cameraPosition[1] + xAxis[2]*cameraPosition[2]),
            -(yAxis[0]*cameraPosition[0] + yAxis[1]*cameraPosition[1] + yAxis[2]*cameraPosition[2]),
            -(zAxis[0]*cameraPosition[0] + zAxis[1]*cameraPosition[1] + zAxis[2]*cameraPosition[2]),
            1
        ];
    },
    translate: function(m, tx, ty, tz) {
        return multiply(m, [1,0,0,0, 0,1,0,0, 0,0,1,0, tx,ty,tz,1]);
    },
    scale: function(m, sx, sy, sz) {
        return multiply(m, [sx,0,0,0, 0,sy,0,0, 0,0,sz,0, 0,0,0,1]);
    },
    rotateY: function(m, angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return multiply(m, [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
    }
};
function normalize(v) { const l = Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]); return [v[0]/l, v[1]/l, v[2]/l]; }
function subtractVectors(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function cross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function multiply(a, b) {
    const dst = [];
    for (let i = 0; i < 4; ++i) {
        for (let j = 0; j < 4; ++j) {
            let s = 0; for (let k = 0; k < 4; ++k) s += a[k*4+j] * b[i*4+k]; dst[i*4+j] = s;
        }
    }
    return dst;
}
function lerp(start, end, t) { return start * (1 - t) + end * t; }

let sapoX = 0, sapoZ = 0;
let targetX = 0, targetZ = 0;
let currentX = 0, currentZ = 0;
let currentAngle = 0, targetAngle = 0, startAngle = 0;
let isMoving = false;
let moveStartTime = 0;
const MOVE_DURATION = 150;
const PASSO = 2.0;
let obstaculos = [];
let moedas = [];
let score = 0;

function gerarMapa() {
    obstaculos = [];
    moedas = [];
    
    for (let z = -10; z <= 50; z++) {
        if (z >= -2 && z <= 3) continue; 
        if (z % 2 !== 0) continue; 

        for (let x = -10; x <= 10; x++) {
            let densidade = 0.4; 

            if (Math.random() < densidade) {
                let tipo = Math.random() < 0.7 ? 'tree' : 'rock';
                obstaculos.push({ x: x, z: z, type: tipo });
            } else {
                if (Math.random() < 0.1) {
                    moedas.push({ x: x, z: z, active: true });
                }
            }
        }
    }
}

function main() {
    const canvas = document.getElementById('gameCanvas');
    const gl = canvas.getContext('webgl');
    if (!gl) return;

    canvas.width = 800; canvas.height = 600;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.53, 0.81, 0.98, 1.0);

    const prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    gl.useProgram(prog);

    const sapoData = parseOBJ(frogData);
    const sapoBuffers = createBuffers(gl, sapoData);
    
    const troncoData = parseOBJ(arvoreTronco);
    const troncoBuffers = createBuffers(gl, troncoData);
    const folhasData = parseOBJ(arvoreFolhas);
    const folhasBuffers = createBuffers(gl, folhasData);
    
    const rockDataObj = parseOBJ(rocha); 
    const rockBuffers = createBuffers(gl, rockDataObj);

    const coinDataObj = parseOBJ(moeda);
    const coinBuffers = createBuffers(gl, coinDataObj);
    
    const heroBaseData = parseOBJ(heroiBase);
    const heroBaseBuffers = createBuffers(gl, heroBaseData);

    const heroLetrasData = parseOBJ(heroiLetras);
    const heroLetrasBuffers = createBuffers(gl, heroLetrasData);

    let currentCharacter = 'sapo';

    const floorData = {
        positions: [-100, 0, 100, 100, 0, 100, -100, 0, -100, 100, 0, -100],
        normals: [0,1,0, 0,1,0, 0,1,0, 0,1,0],
        indices: [0,1,2, 2,1,3]
    };
    const floorBuffers = createBuffers(gl, floorData);

    const charBtn = document.getElementById("charBtn");
    charBtn.addEventListener("click", () => {
        if (currentCharacter === 'sapo') {
            currentCharacter = 'heroi';
            charBtn.blur(); 
            console.log("Trocou para Herói!");
        } else {
            currentCharacter = 'sapo';
            charBtn.blur();
            console.log("Trocou para Sapo!");
        }
    });

    gerarMapa(); 

    const loc = {
        model: gl.getUniformLocation(prog, "u_modelMatrix"),
        view: gl.getUniformLocation(prog, "u_viewMatrix"),
        proj: gl.getUniformLocation(prog, "u_projectionMatrix"),
        color: gl.getUniformLocation(prog, "u_color"),
        light: gl.getUniformLocation(prog, "u_lightPosition"),
        invTrans: gl.getUniformLocation(prog, "u_worldInverseTranspose")
    };

    window.addEventListener("keydown", (e) => {
        if (isMoving) return;

        let proximoX = targetX;
        let proximoZ = targetZ;
        let novoAngulo = targetAngle;
        let tentouMover = false;

        if(e.key === "w" || e.key === "ArrowUp") { 
            proximoZ -= 1; novoAngulo = Math.PI / 2; tentouMover = true;
        }
        else if(e.key === "s" || e.key === "ArrowDown") { 
            proximoZ += 1; novoAngulo = -Math.PI / 2; tentouMover = true;
        }
        else if(e.key === "a" || e.key === "ArrowLeft") { 
            proximoX -= 1; novoAngulo = Math.PI; tentouMover = true;
        }
        else if(e.key === "d" || e.key === "ArrowRight") { 
            proximoX += 1; novoAngulo = 0; tentouMover = true;
        }

        if (tentouMover) {
            const bateu = obstaculos.find(obs => obs.x === proximoX && obs.z === proximoZ);
            if (bateu) { console.log("Bateu!"); return; }

            targetX = proximoX; targetZ = proximoZ; targetAngle = novoAngulo;
            
            const moedaIndex = moedas.findIndex(c => c.x === targetX && c.z === targetZ && c.active);
            if (moedaIndex !== -1) {
                moedas[moedaIndex].active = false;
                score += 10;
                document.getElementById("score").innerText = score;
                if (score >= 20) { 
                    document.getElementById("charBtn").style.display = "block";
                }
            }

            isMoving = true;
            moveStartTime = Date.now();
            startX = currentX; startZ = currentZ; startAngle = currentAngle;
            
            if (Math.abs(targetAngle - startAngle) > Math.PI) {
                if (targetAngle > startAngle) startAngle += Math.PI * 2; 
                else startAngle -= Math.PI * 2;
            }
        }
    });

    let startX = 0, startZ = 0;

    function drawScene() {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        let jumpY = 0;
        if (isMoving) {
            let t = (Date.now() - moveStartTime) / MOVE_DURATION;
            if (t >= 1.0) { t = 1.0; isMoving = false; currentX = targetX; currentZ = targetZ; currentAngle = targetAngle; }
            else {
                currentX = lerp(startX, targetX, t);
                currentZ = lerp(startZ, targetZ, t);
                currentAngle = lerp(startAngle, targetAngle, t);
                jumpY = Math.sin(t * Math.PI) * 1.5;
            }
        }

        const rx = currentX * PASSO;
        const rz = currentZ * PASSO;

        const proj = Matrix.perspective(50 * Math.PI/180, canvas.width/canvas.height, 0.1, 200);
        const view = Matrix.lookAt([rx + 15, 20, rz + 20], [rx, 0, rz], [0,1,0]);
        
        gl.uniformMatrix4fv(loc.proj, false, proj);
        gl.uniformMatrix4fv(loc.view, false, view);
        gl.uniform3fv(loc.light, [30, 50, 20]);

        useBuffers(gl, floorBuffers, prog);

        for(let z = Math.floor(targetZ) - 20; z <= Math.floor(targetZ) + 30; z++) {
            
            if (z % 2 === 0) gl.uniform3fv(loc.color, [0.6, 0.6, 0.6]); 
            else gl.uniform3fv(loc.color, [0.5, 0.5, 0.5]);             
            
            let mFaixa = Matrix.translate(Matrix.identity(), 0, -0.1, z * PASSO);
            mFaixa = Matrix.scale(mFaixa, 1.0, 1.0, 0.01);            
            gl.uniformMatrix4fv(loc.model, false, mFaixa);
            gl.uniformMatrix4fv(loc.invTrans, false, mFaixa); 
            
            gl.drawElements(gl.TRIANGLES, floorData.indices.length, gl.UNSIGNED_SHORT, 0);
        }

        let mChar = Matrix.translate(Matrix.identity(), rx, jumpY, rz);
        mChar = Matrix.rotateY(mChar, currentAngle);

        if (currentCharacter === 'sapo') {
            useBuffers(gl, sapoBuffers, prog);
            gl.uniform3fv(loc.color, [0.2, 0.8, 0.2]); 
            let mSapo = Matrix.scale(mChar, 6.0, 6.0, 6.0);
            gl.uniformMatrix4fv(loc.model, false, mSapo);
            gl.uniformMatrix4fv(loc.invTrans, false, mSapo);
            gl.drawElements(gl.TRIANGLES, sapoData.indices.length, gl.UNSIGNED_SHORT, 0);

} else {
            
            let mBase = Matrix.copy(mChar); 
            
            mBase = Matrix.translate(mBase, 1.0, 0.5, 0.5);
            
            mBase = Matrix.scale(mBase, 0.7, 1.0, 1.0);
            
            gl.uniformMatrix4fv(loc.model, false, mBase);
            gl.uniformMatrix4fv(loc.invTrans, false, mBase);

            useBuffers(gl, heroBaseBuffers, prog);
            gl.uniform3fv(loc.color, [0.13, 0.55, 0.13]);
            gl.drawElements(gl.TRIANGLES, heroBaseData.indices.length, gl.UNSIGNED_SHORT, 0);

            let mLetras = Matrix.copy(mChar);
            
            mLetras = Matrix.translate(mLetras, -0.4, 1.0, 0.3);
            
            mLetras = Matrix.scale(mLetras, 0.02, 0.02, 0.02); 
            
            gl.uniformMatrix4fv(loc.model, false, mLetras);
            gl.uniformMatrix4fv(loc.invTrans, false, mLetras);

            useBuffers(gl, heroLetrasBuffers, prog);
            gl.uniform3fv(loc.color, [1.0, 1.0, 1.0]);
            gl.drawElements(gl.TRIANGLES, heroLetrasData.indices.length, gl.UNSIGNED_SHORT, 0);
        }
           for (const obs of obstaculos) {
            if (obs.type === 'tree') {
                let mTree = Matrix.translate(Matrix.identity(), obs.x * PASSO, 0, obs.z * PASSO);
                mTree = Matrix.scale(mTree, 2.0, 2.0, 2.0);
                gl.uniformMatrix4fv(loc.model, false, mTree);
                gl.uniformMatrix4fv(loc.invTrans, false, mTree);
                useBuffers(gl, troncoBuffers, prog);
                gl.uniform3fv(loc.color, [0.55, 0.27, 0.07]); 
                gl.drawElements(gl.TRIANGLES, troncoData.indices.length, gl.UNSIGNED_SHORT, 0);
                useBuffers(gl, folhasBuffers, prog);
                gl.uniform3fv(loc.color, [0.13, 0.55, 0.13]); 
                gl.drawElements(gl.TRIANGLES, folhasData.indices.length, gl.UNSIGNED_SHORT, 0);
            }
        }

        useBuffers(gl, rockBuffers, prog);
        gl.uniform3fv(loc.color, [0.5, 0.5, 0.55]); 
        for (const obs of obstaculos) {
            if (obs.type === 'rock') {
                let mRock = Matrix.translate(Matrix.identity(), obs.x * PASSO, 0, obs.z * PASSO);
                mRock = Matrix.scale(mRock, 1.5, 1.0, 1.5); 
                gl.uniformMatrix4fv(loc.model, false, mRock);
                gl.uniformMatrix4fv(loc.invTrans, false, mRock);
                gl.drawElements(gl.TRIANGLES, rockDataObj.indices.length, gl.UNSIGNED_SHORT, 0);
            }
        }

        useBuffers(gl, coinBuffers, prog);
        gl.uniform3fv(loc.color, [1.0, 0.84, 0.0]); 
        let anguloMoeda = (Date.now() / 1000) * 3.0; 
        for (const c of moedas) {
            if (c.active) {
                let mCoin = Matrix.translate(Matrix.identity(), c.x * PASSO, 0.5, c.z * PASSO);
                mCoin = Matrix.rotateY(mCoin, anguloMoeda);
                mCoin = Matrix.scale(mCoin, 0.5, 0.5, 0.5); 
                gl.uniformMatrix4fv(loc.model, false, mCoin);
                gl.uniformMatrix4fv(loc.invTrans, false, mCoin);
                gl.drawElements(gl.TRIANGLES, coinDataObj.indices.length, gl.UNSIGNED_SHORT, 0);
            }
        }

        requestAnimationFrame(drawScene);
    }
    drawScene();
}

function createShader(gl, type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
function createProgram(gl, vs, fs) { const p = gl.createProgram(); gl.attachShader(p, createShader(gl,gl.VERTEX_SHADER,vs)); gl.attachShader(p, createShader(gl,gl.FRAGMENT_SHADER,fs)); gl.linkProgram(p); return p; }
function createBuffers(gl, data) {
    const p = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, p); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.positions), gl.STATIC_DRAW);
    const n = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, n); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.normals), gl.STATIC_DRAW);
    const i = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, i); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.indices), gl.STATIC_DRAW);
    return { p, n, i };
}
function useBuffers(gl, buf, prog) {
    const pos = gl.getAttribLocation(prog, "a_position"); const norm = gl.getAttribLocation(prog, "a_normal");
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.p); gl.vertexAttribPointer(pos, 3, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(pos);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.n); gl.vertexAttribPointer(norm, 3, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(norm);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.i);
}

window.onload = main;