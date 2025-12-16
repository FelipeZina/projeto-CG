
function addCube(data, x, y, z, r, g, b, sx = 1, sy = 1, sz = 1) {
    const halfX = sx / 2;
    const halfY = sy / 2;
    const halfZ = sz / 2;

    const v = [
        // Frente
        -halfX, -halfY, halfZ, halfX, -halfY, halfZ, halfX, halfY, halfZ, -halfX, halfY, halfZ,
        // Trás
        -halfX, -halfY, -halfZ, -halfX, halfY, -halfZ, halfX, halfY, -halfZ, halfX, -halfY, -halfZ,
        // Topo
        -halfX, halfY, -halfZ, -halfX, halfY, halfZ, halfX, halfY, halfZ, halfX, halfY, -halfZ,
        // Base
        -halfX, -halfY, -halfZ, halfX, -halfY, -halfZ, halfX, -halfY, halfZ, -halfX, -halfY, halfZ,
        // Direita
        halfX, -halfY, -halfZ, halfX, halfY, -halfZ, halfX, halfY, halfZ, halfX, -halfY, halfZ,
        // Esquerda
        -halfX, -halfY, -halfZ, -halfX, -halfY, halfZ, -halfX, halfY, halfZ, -halfX, halfY, -halfZ,
    ];

    const n = [
        // Frente
        0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
        // Trás
        0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
        // Topo
        0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
        // Base
        0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
        // Direita
        1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
        // Esquerda
        -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
    ];

    const c = [];
    for (let i = 0; i < 24; i++) {
        c.push(r, g, b);
    }

    const startIndex = data.positions.length / 3;

    // Adiciona Vértices transladados
    for (let i = 0; i < v.length; i += 3) {
        data.positions.push(v[i] + x, v[i + 1] + y, v[i + 2] + z);
    }

    // Adiciona Normais
    for (let i = 0; i < n.length; i++) {
        data.normals.push(n[i]);
    }

    // Adiciona Cores
    for (let i = 0; i < c.length; i++) {
        data.colors.push(c[i]);
    }

    // Adiciona Índices
    const ind = [
        0, 1, 2, 0, 2, 3,    // Frente
        4, 5, 6, 4, 6, 7,    // Trás
        8, 9, 10, 8, 10, 11,  // Topo
        12, 13, 14, 12, 14, 15, // Base
        16, 17, 18, 16, 18, 19, // Direita
        20, 21, 22, 20, 22, 23  // Esquerda
    ];

    for (let i = 0; i < ind.length; i++) {
        data.indices.push(startIndex + ind[i]);
    }
}

function createCarModel() {
    const data = { positions: [], normals: [], colors: [], indices: [], texcoords: [] };

    // Corpo Verde/Azul (dependendo do gosto, vamos fazer um azul estilo arcade)
    // x, y, z, r, g, b, sx, sy, sz

    // Base do carro (Chassi) - Azul
    addCube(data, 0, 0.4, 0, 0.2, 0.4, 0.8, 1.8, 0.5, 3.0);

    // Parte de cima (Cabine) - Azul um pouco mais claro ou igual
    addCube(data, 0, 1.0, -0.2, 0.2, 0.4, 0.8, 1.6, 0.7, 1.5);

    // Vidro Parabrisa (Preto/Cinza escuro)
    addCube(data, 0, 1.0, 0.6, 0.2, 0.2, 0.3, 1.4, 0.5, 0.1);

    // Vidro Traseiro
    addCube(data, 0, 1.0, -1.0, 0.8, 0.2, 0.2, 1.4, 0.5, 0.1);
    // (Ops, vidro traseiro vermelho pra parecer luz de freio/detalhe?)
    // Vamos fazer vidro mesmo:
    // addCube(data, 0, 1.0, -1.0, 0.2, 0.2, 0.3,   1.4, 0.5, 0.1);

    // Rodas (Pretas)
    const wheelY = 0.25;
    const wheelX = 0.9; // Um pouco pra fora
    const wheelZ = 1.0;

    // Frente Esquerda
    addCube(data, -wheelX, wheelY, wheelZ, 0.1, 0.1, 0.1, 0.4, 0.5, 0.6);
    // Frente Direita
    addCube(data, wheelX, wheelY, wheelZ, 0.1, 0.1, 0.1, 0.4, 0.5, 0.6);
    // Trás Esquerda
    addCube(data, -wheelX, wheelY, -wheelZ, 0.1, 0.1, 0.1, 0.4, 0.5, 0.6);
    // Trás Direita
    addCube(data, wheelX, wheelY, -wheelZ, 0.1, 0.1, 0.1, 0.4, 0.5, 0.6);

    // Faróis (Amarelos)
    addCube(data, -0.6, 0.45, 1.51, 1.0, 1.0, 0.0, 0.3, 0.2, 0.1);
    addCube(data, 0.6, 0.45, 1.51, 1.0, 1.0, 0.0, 0.3, 0.2, 0.1);

    return data;
}
