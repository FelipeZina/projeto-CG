const vertexShaderSource = `
    attribute vec3 a_position;
    attribute vec3 a_normal;
    attribute vec2 a_texcoord; 
    attribute vec3 a_color;    
    
    varying vec3 v_normal;
    varying vec2 v_texcoord; 
    varying vec3 v_color;       
    
    uniform mat4 u_modelMatrix;
    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;
    uniform mat4 u_worldInverseTranspose;

    void main() {
        vec4 worldPosition = u_modelMatrix * vec4(a_position, 1.0);
        gl_Position = u_projectionMatrix * u_viewMatrix * worldPosition;
        
        v_normal = mat3(u_worldInverseTranspose) * a_normal;
        v_texcoord = a_texcoord; 
        v_color = a_color;      
    }
`;

const fragmentShaderSource = `
    precision mediump float;
    
    uniform vec3 u_color;          
    uniform sampler2D u_texture;   
    uniform bool u_isTextured;     
    uniform bool u_useVertexColor; 
    
    uniform vec3 u_lightDirection1; 
    uniform vec3 u_lightDirection2; 

    varying vec3 v_normal;
    varying vec2 v_texcoord;       
    varying vec3 v_color;          
    
    void main() {
        vec3 normal = normalize(v_normal);
        
        float light1 = max(dot(normal, normalize(u_lightDirection1)), 0.0);
        float light2 = max(dot(normal, normalize(u_lightDirection2)), 0.0);
        
        float totalLight = 0.5 + (light1 * 0.5) + (light2 * 0.4);

        vec4 baseColor;
        
        if (u_isTextured) {
            baseColor = texture2D(u_texture, v_texcoord);
        } else if (u_useVertexColor) {
            baseColor = vec4(v_color, 1.0);
        } else {
            baseColor = vec4(u_color, 1.0);
        }

        gl_FragColor = vec4(baseColor.rgb * totalLight, 1.0);
    }
`;

function parseOBJ(text) {
    const positions = [];
    const normals = [];
    const texcoords = []; 
    const indices = [];

    const tempVertices = [];
    const tempNormals = [];
    const tempTexCoords = []; 

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
        } else if (keyword === 'vt') {
            tempTexCoords.push(args.map(parseFloat));
        } else if (keyword === 'f') {
            const faceVerts = args.map(f => {
                const parts = f.split('/');
                const v = parseInt(parts[0]) - 1;
                const t = parts.length > 1 && parts[1] ? parseInt(parts[1]) - 1 : undefined;
                const n = parts.length > 2 && parts[2] ? parseInt(parts[2]) - 1 : undefined;
                return { v, t, n };
            });

            for (let i = 1; i < faceVerts.length - 1; i++) {
                const tri = [faceVerts[0], faceVerts[i], faceVerts[i + 1]];
                tri.forEach(({ v, t, n }) => {
                    positions.push(...tempVertices[v]);
                    if (t !== undefined && tempTexCoords[t]) {
                        texcoords.push(tempTexCoords[t][0], tempTexCoords[t][1]);
                    } else {
                        texcoords.push(0, 0); 
                    }
                    const norm = n !== undefined ? tempNormals[n] : [0, 1, 0];
                    normals.push(...norm);
                    indices.push(indices.length);
                });
            }
        }
    }
    return { positions, normals, texcoords, indices };
}

const Matrix = {
    copy: function (m) { return m.slice(); },
    identity: function () { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; },
    perspective: function (fovRad, aspect, near, far) {
        const f = Math.tan(Math.PI * 0.5 - 0.5 * fovRad);
        const rangeInv = 1.0 / (near - far);
        return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (near + far) * rangeInv, -1, 0, 0, near * far * rangeInv * 2, 0];
    },
    lookAt: function (cameraPosition, target, up) {
        const zAxis = normalize(subtractVectors(cameraPosition, target));
        const xAxis = normalize(cross(up, zAxis));
        const yAxis = normalize(cross(zAxis, xAxis));
        return [
            xAxis[0], yAxis[0], zAxis[0], 0,
            xAxis[1], yAxis[1], zAxis[1], 0,
            xAxis[2], yAxis[2], zAxis[2], 0,
            -(xAxis[0] * cameraPosition[0] + xAxis[1] * cameraPosition[1] + xAxis[2] * cameraPosition[2]),
            -(yAxis[0] * cameraPosition[0] + yAxis[1] * cameraPosition[1] + yAxis[2] * cameraPosition[2]),
            -(zAxis[0] * cameraPosition[0] + zAxis[1] * cameraPosition[1] + zAxis[2] * cameraPosition[2]),
            1
        ];
    },
    translate: function (m, tx, ty, tz) {
        return multiply(m, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, tx, ty, tz, 1]);
    },
    scale: function (m, sx, sy, sz) {
        return multiply(m, [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1]);
    },
    rotateX: function (m, angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return multiply(m, [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
    },
    rotateY: function (m, angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return multiply(m, [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
    }
};

function normalize(v) { const l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
function subtractVectors(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function multiply(a, b) {
    const dst = [];
    for (let i = 0; i < 4; ++i) {
        for (let j = 0; j < 4; ++j) {
            let s = 0; for (let k = 0; k < 4; ++k) s += a[k * 4 + j] * b[i * 4 + k]; dst[i * 4 + j] = s;
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
const PASSO = 2.0;
let obstaculos = [];
let moedas = [];
let carros = [];
let mapRows = {};
let score = 0;
let cameraMode = 'froggy';
let gameRunning = false;
let currentCharacter = 'sapo';

let troncoZ = 15.0;
let troncoSpeed = 0.04;
let troncoActive = true;

let powerUps = [];
let hasShield = false;
let isTimeFrozen = false;
let moveDuration = 150;
let msgTimeout;

const PU_SHIELD = 0;
const PU_SPEED = 1;
const PU_TIME = 2;

let texGrass, texRoad, texWater;

function gerarMapa() {
    obstaculos = [];
    moedas = [];
    carros = [];
    mapRows = {};
    powerUps = [];

    for (let z = -300; z <= 20; z++) {
        let tipoLinha = 'grass';

        if (z >= -2 && z <= 3) {
            tipoLinha = 'grass';
        } else {
            let rand = Math.random();
            if (rand < 0.3 && z % 2 === 0) tipoLinha = 'river';
            else if (rand > 0.6) tipoLinha = 'road';
        }

        mapRows[z] = tipoLinha;

        if (z % 2 !== 0 && tipoLinha !== 'road') continue;

        if (tipoLinha === 'grass') {
            for (let x = -10; x <= 10; x++) {
                if (Math.random() < 0.4) {
                    let tipo = Math.random() < 0.7 ? 'tree' : 'rock';
                    obstaculos.push({ x: x, z: z, type: tipo });
                } else {
                    let randItem = Math.random();
                    if (randItem < 0.1) {
                        moedas.push({ x: x, z: z, active: true });
                    }
                    else if (randItem > 0.98) {
                        let tipoPower = Math.floor(Math.random() * 3);
                        powerUps.push({ x: x, z: z, active: true, type: tipoPower });
                    }
                }
            }
        }
        else if (tipoLinha === 'river') {
            for (let x = -10; x <= 10; x++) {
                if (Math.random() < 0.4) {
                    obstaculos.push({ x: x, z: z, type: 'lilypad' });
                }
            }
        }
        else if (tipoLinha === 'road') {
            let direction = (z % 2 === 0) ? 1 : -1;
            let speed = (0.05 + Math.random() * 0.05) * direction;
            let numCarros = 1 + Math.floor(Math.random() * 2);
            let carrosNaFaixa = []; 

            for (let k = 0; k < numCarros; k++) {
                let startX;
                let valid = false;
                let attempts = 0;

                while (!valid && attempts < 10) {
                    startX = -15 + Math.random() * 30;
                    valid = true;
                    for (let otherX of carrosNaFaixa) {
                        if (Math.abs(startX - otherX) < 8.0) { 
                            valid = false;
                            break;
                        }
                    }
                    attempts++;
                }

                if (valid) {
                    carrosNaFaixa.push(startX);
                    carros.push({
                        x: startX,
                        z: z,
                        speed: speed,
                        modelIndex: Math.floor(Math.random() * 6) 
                    });
                }
            }
        }
    }
}

function iniciarJogo(modo) {
    if (modo === 'easy') {
        troncoActive = false;
    } else if (modo === 'normal') {
        troncoActive = true;
        troncoSpeed = 0.04;
    } else if (modo === 'hard') {
        troncoActive = true;
        troncoSpeed = 0.08;
    }

    sapoX = 0; sapoZ = 0;
    targetX = 0; targetZ = 0;
    currentX = 0; currentZ = 0;
    score = 0;
    troncoZ = 20.0;
    hasShield = false;
    isTimeFrozen = false;
    moveDuration = 150;

    document.getElementById("score").innerText = 0;

    document.getElementById("startMenu").style.display = "none";
    document.getElementById("gameOver").style.display = "none";
    document.getElementById("ui").style.display = "block";
    document.getElementById("instructions").style.display = "block";

    gerarMapa();
    gameRunning = true;
    requestAnimationFrame(loopDoJogo);
}

let loopDoJogo;
function mostrarMensagem(texto, cor) {
    const el = document.getElementById("powerUpMsg");
    if (!el) return; 
    el.innerText = texto;
    el.style.color = cor;

    el.style.opacity = 1;
    el.style.transform = "translate(-50%, -50%) scale(1.2)"; 

    if (msgTimeout) clearTimeout(msgTimeout);

    msgTimeout = setTimeout(() => {
        el.style.opacity = 0;
        el.style.transform = "translate(-50%, -50%) scale(1.0)";
    }, 2000);
}
function ativarPowerUp(tipo) {
    if (tipo === PU_SHIELD) {
        hasShield = true;
        mostrarMensagem("🛡️ ESCUDO ATIVO!", "#00FFFF"); 
    }
    else if (tipo === PU_SPEED) {
        mostrarMensagem("⚡ VELOCIDADE MÁXIMA!", "#FFFF00"); 
        moveDuration = 70;
        setTimeout(() => {
            moveDuration = 150;
        }, 8000);
    }
    else if (tipo === PU_TIME) {
        mostrarMensagem("⏳ TEMPO CONGELADO!", "#FF00FF"); 
        isTimeFrozen = true;
        setTimeout(() => {
            isTimeFrozen = false;
        }, 5000);
    }
}

function morrer(instakill) {
    if (hasShield && !instakill) {
        console.log("ESCUDO SALVOU! Pulando pra frente.");
        hasShield = false;
        targetZ -= 1;
        currentZ = targetZ;
        return; 
    }

    gameRunning = false;
    document.getElementById("finalScore").innerText = score;
    document.getElementById("ui").style.display = "none";
    document.getElementById("instructions").style.display = "none";
    document.getElementById("gameOver").style.display = "block";
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

    const powerUpData = parseOBJ(powerup);
    const powerUpBuffers = createBuffers(gl, powerUpData);

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

    const lilyDataObj = createLilypadModel();
    const lilyBuffers = createBuffers(gl, lilyDataObj);

    const carColorsDefs = [
        [0.8, 0.2, 0.2], 
        [0.2, 0.4, 0.8], 
        [0.9, 0.9, 0.1], 
        [0.1, 0.8, 0.2], 
        [0.8, 0.2, 0.8], 
        [0.9, 0.5, 0.1]  
    ];

    const carBuffersList = carColorsDefs.map(color => {
        const data = createCarModel(color[0], color[1], color[2]);
        return createBuffers(gl, data);
    });

    const carGeometryCount = createCarModel(1,1,1).indices.length;

    
    texGrass = loadTexture(gl, 'grass.jpg');
    texRoad = loadTexture(gl, 'road.jpg');
    texWater = loadTexture(gl, 'water.jpg');

    const floorData = {
        positions: [-100, 0, 100, 100, 0, 100, -100, 0, -100, 100, 0, -100],
        normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
        texcoords: [0, 0, 20, 0, 0, 1, 20, 1],
        indices: [0, 1, 2, 2, 1, 3]
    };
    const floorBuffers = createBuffers(gl, floorData);

    document.getElementById("btnModeEasy").addEventListener("click", () => iniciarJogo('easy'));
    document.getElementById("btnModeNormal").addEventListener("click", () => iniciarJogo('normal'));
    document.getElementById("btnModeHard").addEventListener("click", () => iniciarJogo('hard'));

    document.getElementById("restartButton").addEventListener("click", () => {
        document.getElementById("gameOver").style.display = "none";
        document.getElementById("startMenu").style.display = "block";
    });

    const btnCam = document.getElementById("btnCameraToggle");
    if (btnCam) {
        btnCam.addEventListener("click", () => {
            if (cameraMode === 'froggy') {
                cameraMode = 'isometric';
                btnCam.innerText = "Câmera: Crossy Road 🐔";
            } else {
                cameraMode = 'froggy';
                btnCam.innerText = "Câmera: Froggy 🐸";
            }
        });
    }

    const charBtn = document.getElementById("charBtn");
    charBtn.addEventListener("click", () => {
        if (currentCharacter === 'sapo') currentCharacter = 'heroi';
        else currentCharacter = 'sapo';
        charBtn.blur();
    });

    const loc = {
        model: gl.getUniformLocation(prog, "u_modelMatrix"),
        view: gl.getUniformLocation(prog, "u_viewMatrix"),
        proj: gl.getUniformLocation(prog, "u_projectionMatrix"),
        color: gl.getUniformLocation(prog, "u_color"),

        lightDir1: gl.getUniformLocation(prog, "u_lightDirection1"),
        lightDir2: gl.getUniformLocation(prog, "u_lightDirection2"),

        invTrans: gl.getUniformLocation(prog, "u_worldInverseTranspose"),
        isTextured: gl.getUniformLocation(prog, "u_isTextured"),
        texture: gl.getUniformLocation(prog, "u_texture"),
        useVertexColor: gl.getUniformLocation(prog, "u_useVertexColor")
    };

    window.addEventListener("keydown", (e) => {
        if (isMoving || !gameRunning) return;

        let proximoX = targetX;
        let proximoZ = targetZ;
        let novoAngulo = targetAngle;
        let tentouMover = false;

        if (e.key === "w" || e.key === "ArrowUp") {
            proximoZ -= 1; novoAngulo = Math.PI / 2; tentouMover = true;
        }
        else if (e.key === "s" || e.key === "ArrowDown") {
            proximoZ += 1; novoAngulo = -Math.PI / 2; tentouMover = true;
        }
        else if (e.key === "a" || e.key === "ArrowLeft") {
            proximoX -= 1; novoAngulo = Math.PI; tentouMover = true;
        }
        else if (e.key === "d" || e.key === "ArrowRight") {
            proximoX += 1; novoAngulo = 0; tentouMover = true;
        }

        if (tentouMover) {
            if (proximoX < -10 || proximoX > 10) {
                return; 
            }

            const bateu = obstaculos.find(obs => obs.x === proximoX && obs.z === proximoZ && obs.type !== 'lilypad');
            if (bateu) { return; }

            targetX = proximoX; targetZ = proximoZ; targetAngle = novoAngulo;

            let tipoTerreno = mapRows[targetZ];
            if (tipoTerreno === 'river') {
                const emCimaDaFolha = obstaculos.find(obs =>
                    obs.x === targetX && obs.z === targetZ && obs.type === 'lilypad'
                );
                if (!emCimaDaFolha) {
                    setTimeout(() => morrer(false), 300);
                }
            }

            const moedaIndex = moedas.findIndex(c => c.x === targetX && c.z === targetZ && c.active);
            if (moedaIndex !== -1) {
                moedas[moedaIndex].active = false;
                score += 10;
                document.getElementById("score").innerText = score;
                if (score >= 20) {
                    document.getElementById("charBtn").style.display = "block";
                }
            }

            const puIndex = powerUps.findIndex(p => p.x === targetX && p.z === targetZ && p.active);
            if (puIndex !== -1) {
                let pu = powerUps[puIndex];
                pu.active = false;
                ativarPowerUp(pu.type);
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

    loopDoJogo = function () {
        if (!gameRunning) return;

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        if (troncoActive && !isTimeFrozen) {
            troncoZ -= troncoSpeed;
            let sapoRealZ = currentZ * PASSO;
            if (troncoZ <= sapoRealZ + 2.0) {
                console.log("ESMAGADO!");
                morrer(true);
                return;
            }
        }

        let jumpY = 0;
        if (isMoving) {
            let t = (Date.now() - moveStartTime) / moveDuration;
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

        const proj = Matrix.perspective(50 * Math.PI / 180, canvas.width / canvas.height, 0.1, 500);

        let view;
        if (cameraMode === 'froggy') {
            view = Matrix.lookAt([rx, 20, rz + 20], [rx, 2, rz], [0, 1, 0]);
        } else {
            view = Matrix.lookAt([rx + 13, 20, rz + 20], [rx, 0, rz], [0, 1, 0]);
        }
        gl.uniformMatrix4fv(loc.proj, false, proj);
        gl.uniformMatrix4fv(loc.view, false, view);
        gl.uniform3fv(loc.lightDir1, [0.8, 1.0, 0.5]);
        gl.uniform3fv(loc.lightDir2, [-0.8, 0.5, 0.5]);

        useBuffers(gl, floorBuffers, prog);

        gl.uniform1i(loc.isTextured, 1);
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(loc.texture, 0);

        for (let z = Math.floor(targetZ) - 60; z <= Math.floor(targetZ) + 10; z++) {
            let tipo = mapRows[z] || 'grass';

            if (tipo === 'river') {
                gl.bindTexture(gl.TEXTURE_2D, texWater);
            } else if (tipo === 'road') {
                gl.bindTexture(gl.TEXTURE_2D, texRoad);
            } else {
                gl.bindTexture(gl.TEXTURE_2D, texGrass);
            }

            let mFaixa = Matrix.translate(Matrix.identity(), 0, -0.1, z * PASSO);
            mFaixa = Matrix.scale(mFaixa, 1.0, 1.0, 0.01);
            gl.uniformMatrix4fv(loc.model, false, mFaixa);
            gl.drawElements(gl.TRIANGLES, floorData.indices.length, gl.UNSIGNED_SHORT, 0);
        }

        gl.uniform1i(loc.isTextured, 0);

        useBuffers(gl, powerUpBuffers, prog);
        gl.uniform3fv(loc.color, [1.0, 0.0, 0.0]);

        let anguloPU = Date.now() / 500;

        for (const p of powerUps) {
            if (Math.abs(p.z - targetZ) > 40) continue;
            if (p.active) {
                let mPu = Matrix.translate(Matrix.identity(), p.x * PASSO, 0.8, p.z * PASSO);
                mPu = Matrix.rotateY(mPu, anguloPU);
                mPu = Matrix.rotateX(mPu, anguloPU);
                mPu = Matrix.scale(mPu, 0.8, 0.8, 0.8);
                gl.uniformMatrix4fv(loc.model, false, mPu);
                gl.uniformMatrix4fv(loc.invTrans, false, mPu);
                gl.drawElements(gl.TRIANGLES, powerUpData.indices.length, gl.UNSIGNED_SHORT, 0);
            }
        }

        if (troncoActive) {
            useBuffers(gl, coinBuffers, prog);
            gl.uniform3fv(loc.color, [0.4, 0.2, 0.1]);
            let mTronco = Matrix.translate(Matrix.identity(), 0, 1.0, troncoZ);
            let anguloRolagem = -(Date.now() / 1000) * 2.0;
            mTronco = Matrix.rotateX(mTronco, anguloRolagem);
            mTronco = Matrix.rotateY(mTronco, Math.PI / 2);
            mTronco = Matrix.scale(mTronco, 2.0, 2.0, 300.0);
            gl.uniformMatrix4fv(loc.model, false, mTronco);
            gl.uniformMatrix4fv(loc.invTrans, false, mTronco);
            gl.drawElements(gl.TRIANGLES, coinDataObj.indices.length, gl.UNSIGNED_SHORT, 0);
        }

        let mChar = Matrix.translate(Matrix.identity(), rx, jumpY, rz);
        mChar = Matrix.rotateY(mChar, currentAngle);

        if (currentCharacter === 'sapo') {
            useBuffers(gl, sapoBuffers, prog);
            if (hasShield) gl.uniform3fv(loc.color, [0.8, 0.8, 1.0]);
            else gl.uniform3fv(loc.color, [0.2, 0.8, 0.2]);

            let mSapo = Matrix.scale(mChar, 5.0, 5.0, 5.0);
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

            if (hasShield) gl.uniform3fv(loc.color, [0.8, 0.8, 1.0]);
            else gl.uniform3fv(loc.color, [0.13, 0.75, 0.13]);

            gl.drawElements(gl.TRIANGLES, heroBaseData.indices.length, gl.UNSIGNED_SHORT, 0);

            let mLetras = Matrix.copy(mChar);
            mLetras = Matrix.translate(mLetras, -0.7, 1.0, 0.3);
            mLetras = Matrix.scale(mLetras, 0.02, 0.02, 0.02);
            gl.uniformMatrix4fv(loc.model, false, mLetras);
            gl.uniformMatrix4fv(loc.invTrans, false, mLetras);
            useBuffers(gl, heroLetrasBuffers, prog);
            gl.uniform3fv(loc.color, [1.0, 1.0, 1.0]);
            gl.drawElements(gl.TRIANGLES, heroLetrasData.indices.length, gl.UNSIGNED_SHORT, 0);
        }

        for (const obs of obstaculos) {
            if (Math.abs(obs.z - targetZ) > 40) continue;

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
            if (Math.abs(obs.z - targetZ) > 40) continue;
            if (obs.type === 'rock') {
                let mRock = Matrix.translate(Matrix.identity(), obs.x * PASSO, 0, obs.z * PASSO);
                mRock = Matrix.scale(mRock, 1.5, 1.0, 1.5);
                gl.uniformMatrix4fv(loc.model, false, mRock);
                gl.uniformMatrix4fv(loc.invTrans, false, mRock);
                gl.drawElements(gl.TRIANGLES, rockDataObj.indices.length, gl.UNSIGNED_SHORT, 0);
            }
        }

        useBuffers(gl, lilyBuffers, prog);
        gl.uniform1i(gl.getUniformLocation(prog, "u_useVertexColor"), 1);

        for (const obs of obstaculos) {
            if (Math.abs(obs.z - targetZ) > 40) continue;
            if (obs.type === 'lilypad') {
                let mLily = Matrix.translate(Matrix.identity(), obs.x * PASSO, 0, obs.z * PASSO);
                mLily = Matrix.scale(mLily, 1.2, 1.2, 1.2);
                gl.uniformMatrix4fv(loc.model, false, mLily);
                gl.uniformMatrix4fv(loc.invTrans, false, mLily);
                gl.drawElements(gl.TRIANGLES, lilyDataObj.indices.length, gl.UNSIGNED_SHORT, 0);
            }
        }
        gl.uniform1i(gl.getUniformLocation(prog, "u_useVertexColor"), 0); 

        useBuffers(gl, coinBuffers, prog);
        gl.uniform3fv(loc.color, [1.0, 0.84, 0.0]);
        let anguloMoeda = (Date.now() / 1000) * 3.0;
        for (const c of moedas) {
            if (Math.abs(c.z - targetZ) > 40) continue;
            if (c.active) {
                let mCoin = Matrix.translate(Matrix.identity(), c.x * PASSO, 0.5, c.z * PASSO);
                mCoin = Matrix.rotateY(mCoin, anguloMoeda);
                mCoin = Matrix.scale(mCoin, 0.4, 0.4, 0.4);
                gl.uniformMatrix4fv(loc.model, false, mCoin);
                gl.uniformMatrix4fv(loc.invTrans, false, mCoin);
                gl.drawElements(gl.TRIANGLES, coinDataObj.indices.length, gl.UNSIGNED_SHORT, 0);
            }
        }

        gl.uniform1i(gl.getUniformLocation(prog, "u_useVertexColor"), 1); 

        for (const carro of carros) {
            if (Math.abs(carro.z - targetZ) > 40) continue;

            if (!isTimeFrozen) {
                carro.x += carro.speed;
                if (carro.x > 20) carro.x = -20;
                if (carro.x < -20) carro.x = 20;
            }

            const bufferToUse = carBuffersList[carro.modelIndex || 0];
            useBuffers(gl, bufferToUse, prog);

            let mCar = Matrix.translate(Matrix.identity(), carro.x * PASSO, 0.0, carro.z * PASSO);

            if (carro.speed > 0) {
                mCar = Matrix.rotateY(mCar, Math.PI / 2);
            } else {
                mCar = Matrix.rotateY(mCar, -Math.PI / 2);
            }

            mCar = Matrix.scale(mCar, 0.8, 0.8, 0.8);
            gl.uniformMatrix4fv(loc.model, false, mCar);
            gl.uniformMatrix4fv(loc.invTrans, false, mCar);
            gl.drawElements(gl.TRIANGLES, carGeometryCount, gl.UNSIGNED_SHORT, 0);

            if (Math.abs(carro.z - targetZ) < 0.3) {
                if (Math.abs(carro.x - currentX) < 1.2) {
                    morrer(false);
                    if (!gameRunning) return;
                }
            }
        }
        gl.uniform1i(gl.getUniformLocation(prog, "u_useVertexColor"), 0); 

        requestAnimationFrame(loopDoJogo);
    }

    requestAnimationFrame(loopDoJogo);
}

function createShader(gl, type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
function createProgram(gl, vs, fs) { const p = gl.createProgram(); gl.attachShader(p, createShader(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, createShader(gl, gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); return p; }
function createBuffers(gl, data) {
    const p = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, p);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.positions), gl.STATIC_DRAW);

    const n = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, n);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.normals), gl.STATIC_DRAW);

    let t = null;
    if (data.texcoords) {
        t = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, t);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.texcoords), gl.STATIC_DRAW);
    }

    const i = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, i);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.indices), gl.STATIC_DRAW);

    let c = null;
    if (data.colors && data.colors.length > 0) {
        c = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, c);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.colors), gl.STATIC_DRAW);
    }

    return { p, n, t, c, i };
}
function useBuffers(gl, buf, prog) {
    const pos = gl.getAttribLocation(prog, "a_position");
    const norm = gl.getAttribLocation(prog, "a_normal");
    const tex = gl.getAttribLocation(prog, "a_texcoord");

    gl.bindBuffer(gl.ARRAY_BUFFER, buf.p);
    gl.vertexAttribPointer(pos, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(pos);

    gl.bindBuffer(gl.ARRAY_BUFFER, buf.n);
    gl.vertexAttribPointer(norm, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(norm);

    if (buf.t && tex !== -1) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buf.t);
        gl.vertexAttribPointer(tex, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(tex);
    } else if (tex !== -1) {
        gl.disableVertexAttribArray(tex);
    }

    const col = gl.getAttribLocation(prog, "a_color");
    if (buf.c && col !== -1) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buf.c);
        gl.vertexAttribPointer(col, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(col);
    } else if (col !== -1) {
        gl.disableVertexAttribArray(col);
        gl.vertexAttrib3f(col, 1.0, 1.0, 1.0);
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.i);
}

function loadTexture(gl, url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    const pixel = new Uint8Array([0, 0, 255, 255]);
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
        width, height, border, srcFormat, srcType,
        pixel);

    const image = new Image();
    image.onload = function () {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
            srcFormat, srcType, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    };
    image.src = url;

    return texture;
}
window.onload = main;