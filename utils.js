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

    // [NEW] Buffer de Cores
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
