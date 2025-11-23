// --- SHADERS ---
const vertexShaderSource = `
    attribute vec3 a_position;
    attribute vec3 a_normal;
    
    varying vec3 v_normal;
    varying vec3 v_surfaceToLight;
    varying vec3 v_surfaceToView;
    
    uniform mat4 u_modelMatrix;
    uniform mat4 u_viewingMatrix;
    uniform mat4 u_projectionMatrix;
    uniform mat4 u_inverseTransposeModelMatrix;
    
    uniform vec3 u_lightPosition;
    uniform vec3 u_viewPosition;

    void main() {
        gl_Position = u_projectionMatrix * u_viewingMatrix * u_modelMatrix * vec4(a_position,1.0);
        v_normal = normalize(mat3(u_inverseTransposeModelMatrix) * a_normal);
        vec3 surfacePosition = (u_modelMatrix * vec4(a_position, 1.0)).xyz;
        v_surfaceToLight = u_lightPosition - surfacePosition;
        v_surfaceToView = u_viewPosition - surfacePosition;
    }
`;

const fragmentShaderSource = `
    precision mediump float;
    uniform vec3 u_color;
    varying vec3 v_normal;
    varying vec3 v_surfaceToLight;
    varying vec3 v_surfaceToView;
    
    void main() {
      vec3 ambientReflection = u_color;
      vec3 diffuseReflection = u_color;
      vec3 specularReflection = vec3(1.0,1.0,1.0);

      gl_FragColor = vec4(diffuseReflection, 1.0);

      vec3 normal = normalize(v_normal);
      vec3 surfaceToLightDirection = normalize(v_surfaceToLight);
      vec3 surfaceToViewDirection = normalize(v_surfaceToView);
      vec3 halfVector = normalize(surfaceToLightDirection + surfaceToViewDirection);

      float light = dot(surfaceToLightDirection,normal);
      float specular = 0.0;
      if (light > 0.0) {
        specular = pow(dot(normal, halfVector), 250.0);
      }

      gl_FragColor.rgb = 0.5*ambientReflection + 0.5*light*diffuseReflection;
      gl_FragColor.rgb += specular*specularReflection;
    }
`;

// --- FUNÇÕES UTILITÁRIAS (Compilar Shaders) ---

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Error compiling shader:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Error linking program:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

// Parse OBJ (Lê o texto do arquivo .obj)
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
          const norm = n !== undefined ? tempNormals[n] : [0, 0, 1];
          positions.push(...vert);
          normals.push(...norm);
          indices.push(indices.length);
        });
      }
    }
  }
  return { positions, normals, indices };
}

// --- VARIÁVEIS DO JOGO (SAPO) ---
let sapoX = 0;  // Posição no Grid X (esquerda/direita)
let sapoZ = 0;  // Posição no Grid Z (frente/trás)
const PASSO = 5.0; // Tamanho do "pulo"

// --- FUNÇÃO PRINCIPAL ---

function main() {
    const canvas = document.getElementById('gameCanvas');
    const gl = canvas.getContext('webgl');

    if (!gl) {
        console.error('WebGL not supported');
        return;
    }

    // Setup Shaders
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = createProgram(gl, vertexShader, fragmentShader);
    gl.useProgram(program);

    // Localização das Variáveis na GPU
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const normalLocation = gl.getAttribLocation(program, 'a_normal');
    
    const colorUniformLocation = gl.getUniformLocation(program, 'u_color');
    const modelViewMatrixUniformLocation = gl.getUniformLocation(program,'u_modelMatrix');
    const viewingMatrixUniformLocation = gl.getUniformLocation(program,'u_viewingMatrix');
    const projectionMatrixUniformLocation = gl.getUniformLocation(program,'u_projectionMatrix');
    const inverseTransposeModelViewMatrixUniformLocation = gl.getUniformLocation(program, `u_inverseTransposeModelMatrix`);
    const lightPositionUniformLocation = gl.getUniformLocation(program,'u_lightPosition');
    const viewPositionUniformLocation = gl.getUniformLocation(program,'u_viewPosition');

    // Buffers
    const VertexBuffer = gl.createBuffer();
    const NormalBuffer = gl.createBuffer();
    const IndexBuffer = gl.createBuffer();

    // Configuração Inicial do WebGL
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.0, 0.0, 0.0, 1.0); // Fundo Preto

    // --- INPUT (TECLADO) ---
    const bodyElement = document.querySelector("body");
    bodyElement.addEventListener("keydown", keyDown, false);

    function keyDown(event){
      // event.preventDefault(); // Comentei para não travar o refresh do F5
      switch(event.key){
        case 'w':
        case 'ArrowUp':
             sapoZ -= 1; // Vai para o fundo
             break;
        case 's':
        case 'ArrowDown':
             sapoZ += 1; // Vem para frente
             break;
        case 'a':
        case 'ArrowLeft':
             sapoX -= 1; // Vai para esquerda
             break;
        case 'd':
        case 'ArrowRight':
             sapoX += 1; // Vai para direita
             break;
        case 'c':
             console.log("Trocar câmera (implementar depois)");
             break;
      }
      console.log(`Sapo em X:${sapoX}, Z:${sapoZ}`);
    }

    // --- CARREGAR O MODELO ---
    const objData = parseOBJ(teapotData); 

    let objVertices = new Float32Array(objData.positions);
    let objNormals = new Float32Array(objData.normals);
    let objIndices = new Uint16Array(objData.indices)

    gl.bindBuffer(gl.ARRAY_BUFFER, VertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, objVertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, NormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, objNormals, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, IndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, objIndices, gl.STATIC_DRAW);

    // --- CONFIGURAÇÃO DE LUZ E COR ---
    gl.uniform3fv(lightPositionUniformLocation, new Float32Array([40.0,40.0,40.0]));
    let color = [1.0, 0.0, 0.0]; // Sapo Vermelho
    gl.uniform3fv(colorUniformLocation, new Float32Array(color));

    // --- PROJEÇÃO ---
    // Ajuste da proporção para 800x600 (-15 a 15 no Y)
    let projectionMatrix = m4.setPerspectiveProjectionMatrix(-20, 20, -15, 15, -1, -100);
    gl.uniformMatrix4fv(projectionMatrixUniformLocation,false,projectionMatrix);

    // --- LOOP DE DESENHO ---
    function drawObj(){
      gl.enableVertexAttribArray(positionLocation);
      gl.bindBuffer(gl.ARRAY_BUFFER, VertexBuffer);
      gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

      gl.enableVertexAttribArray(normalLocation);
      gl.bindBuffer(gl.ARRAY_BUFFER, NormalBuffer);
      gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, IndexBuffer);
      
      // 1. ATUALIZAR CÂMERA (SEGUIR O JOGADOR)
      let sapoWorldX = sapoX * PASSO;
      let sapoWorldZ = sapoZ * PASSO;

      // Câmera fica atrás (+Z) e acima (+Y) do sapo
      let P0 = [sapoWorldX, 30.0, sapoWorldZ + 40.0]; 
      let Pref = [sapoWorldX, 0.0, sapoWorldZ];
      let V = [0.0, 1.0, 0.0];
      
      let viewingMatrix = m4.setViewingMatrix(P0, Pref, V);
      gl.uniformMatrix4fv(viewingMatrixUniformLocation, false, viewingMatrix);
      gl.uniform3fv(viewPositionUniformLocation, new Float32Array(P0));

      // 2. ATUALIZAR POSIÇÃO DO MODELO
      let modelViewMatrix = m4.identity();
      modelViewMatrix = m4.translate(modelViewMatrix, sapoWorldX, 0.0, sapoWorldZ);
      modelViewMatrix = m4.scale(modelViewMatrix, 20.0, 20.0, 20.0);

      let inverseTransposeModelViewMatrix = m4.transpose(m4.inverse(modelViewMatrix));

      gl.uniformMatrix4fv(modelViewMatrixUniformLocation,false,modelViewMatrix);
      gl.uniformMatrix4fv(inverseTransposeModelViewMatrixUniformLocation,false,inverseTransposeModelViewMatrix);
      
      gl.drawElements(gl.TRIANGLES, objIndices.length, gl.UNSIGNED_SHORT, 0);
    }

    function drawScene(){
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      
      drawObj();

      requestAnimationFrame(drawScene);
    }

    drawScene();
}

window.addEventListener('load', main);

// --- FUNÇÕES MATEMÁTICAS AUXILIARES (NECESSÁRIAS PARA O M4.JS) ---

function crossProduct(v1, v2) {
    let result = [
        v1[1] * v2[2] - v1[2] * v2[1],
        v1[2] * v2[0] - v1[0] * v2[2],
        v1[0] * v2[1] - v1[1] * v2[0]
    ];
    return result;
}

function unitVector(v){ 
    let vModulus = vectorModulus(v);
    return v.map(function(x) { return x/vModulus; });
}

function vectorModulus(v){
    return Math.sqrt(Math.pow(v[0],2)+Math.pow(v[1],2)+Math.pow(v[2],2));
}

function radToDeg(r) {
    return r * 180 / Math.PI;
}

function degToRad(d) {
    return d * Math.PI / 180;
}