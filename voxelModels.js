
function addCube(data, x, y, z, r, g, b, sx = 1, sy = 1, sz = 1) {
    const halfX = sx / 2;
    const halfY = sy / 2;
    const halfZ = sz / 2;

    const v = [
        -halfX, -halfY, halfZ, halfX, -halfY, halfZ, halfX, halfY, halfZ, -halfX, halfY, halfZ,
        -halfX, -halfY, -halfZ, -halfX, halfY, -halfZ, halfX, halfY, -halfZ, halfX, -halfY, -halfZ,
        -halfX, halfY, -halfZ, -halfX, halfY, halfZ, halfX, halfY, halfZ, halfX, halfY, -halfZ,
        -halfX, -halfY, -halfZ, halfX, -halfY, -halfZ, halfX, -halfY, halfZ, -halfX, -halfY, halfZ,
        halfX, -halfY, -halfZ, halfX, halfY, -halfZ, halfX, halfY, halfZ, halfX, -halfY, halfZ,
        -halfX, -halfY, -halfZ, -halfX, -halfY, halfZ, -halfX, halfY, halfZ, -halfX, halfY, -halfZ,
    ];

    const n = [
        0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
        0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
        0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
        0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
        1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
        -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
    ];

    const c = [];
    for (let i = 0; i < 24; i++) {
        c.push(r, g, b);
    }

    const startIndex = data.positions.length / 3;

    for (let i = 0; i < v.length; i += 3) {
        data.positions.push(v[i] + x, v[i + 1] + y, v[i + 2] + z);
    }

    for (let i = 0; i < n.length; i++) {
        data.normals.push(n[i]);
    }

    for (let i = 0; i < c.length; i++) {
        data.colors.push(c[i]);
    }

    const ind = [
        0, 1, 2, 0, 2, 3,    
        4, 5, 6, 4, 6, 7,    
        8, 9, 10, 8, 10, 11,  
        12, 13, 14, 12, 14, 15, 
        16, 17, 18, 16, 18, 19, 
        20, 21, 22, 20, 22, 23  
    ];

    for (let i = 0; i < ind.length; i++) {
        data.indices.push(startIndex + ind[i]);
    }
}

function createCarModel(r = 0.2, g = 0.4, b = 0.8) {
    const data = { positions: [], normals: [], colors: [], indices: [], texcoords: [] };

    addCube(data, 0, 0.4, 0, r, g, b, 1.8, 0.5, 3.0);

    addCube(data, 0, 1.0, -0.2, r, g, b, 1.6, 0.7, 1.5);

    addCube(data, 0, 1.0, 0.6, 0.2, 0.2, 0.3, 1.4, 0.5, 0.1);

    addCube(data, 0, 1.0, -1.0, 0.8, 0.2, 0.2, 1.4, 0.5, 0.1);

    const wheelY = 0.25;
    const wheelX = 0.9; 
    const wheelZ = 1.0;

    addCube(data, -wheelX, wheelY, wheelZ, 0.1, 0.1, 0.1, 0.4, 0.5, 0.6);
    addCube(data, wheelX, wheelY, wheelZ, 0.1, 0.1, 0.1, 0.4, 0.5, 0.6);
    addCube(data, -wheelX, wheelY, -wheelZ, 0.1, 0.1, 0.1, 0.4, 0.5, 0.6);
    addCube(data, wheelX, wheelY, -wheelZ, 0.1, 0.1, 0.1, 0.4, 0.5, 0.6);

    addCube(data, -0.6, 0.45, 1.51, 1.0, 1.0, 0.0, 0.3, 0.2, 0.1);
    addCube(data, 0.6, 0.45, 1.51, 1.0, 1.0, 0.0, 0.3, 0.2, 0.1);

    return data;
}

function createLilypadModel() {
    const data = { positions: [], normals: [], colors: [], indices: [], texcoords: [] };

    addCube(data, 0, 0.05, 0, 0.0, 0.5, 0.1, 1.2, 0.1, 1.2);

    addCube(data, 0.7, 0.05, 0.0, 0.0, 0.5, 0.1, 0.4, 0.1, 0.8);
    addCube(data, -0.7, 0.05, 0.0, 0.0, 0.5, 0.1, 0.4, 0.1, 0.8);
    addCube(data, 0.0, 0.05, 0.7, 0.0, 0.5, 0.1, 0.8, 0.1, 0.4);
    addCube(data, 0.0, 0.05, -0.7, 0.0, 0.5, 0.1, 0.8, 0.1, 0.4);

    addCube(data, 0, 0.2, 0, 1.0, 0.75, 0.8, 0.4, 0.2, 0.4);
    addCube(data, 0, 0.3, 0, 1.0, 0.9, 0.9, 0.2, 0.2, 0.2); 

    return data;
}
