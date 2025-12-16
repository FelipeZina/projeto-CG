const vertexShaderSource = `
    attribute vec3 a_position;
    attribute vec3 a_normal;
    attribute vec2 a_texcoord; 
    attribute vec3 a_color;
    
    varying vec3 v_normal;
    varying vec2 v_texcoord; 
    varying vec3 v_color;
    varying vec3 v_worldPosition;

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
        v_worldPosition = worldPosition.xyz;
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
    
    uniform vec3 u_lightColor1;
    uniform vec3 u_lightColor2;
    uniform vec3 u_ambientColor;

    uniform vec3 u_viewWorldPosition;

    varying vec3 v_normal;
    varying vec2 v_texcoord;       
    varying vec3 v_color;
    varying vec3 v_worldPosition;
    
    void main() {
        vec3 normal = normalize(v_normal);
        vec3 surfaceToView = normalize(u_viewWorldPosition - v_worldPosition);
        
        // ILUMINAÇÃO PHONG (Blinn-Phong)
        // Luz 1 (Sol)
        vec3 lightDir1 = normalize(u_lightDirection1);
        float diff1 = max(dot(normal, lightDir1), 0.0);
        float spec1 = 0.0;
        if (diff1 > 0.0) {
            vec3 halfVector1 = normalize(lightDir1 + surfaceToView);
            spec1 = pow(max(dot(normal, halfVector1), 0.0), 50.0); // Brilho
        }
        
        // Luz 2 (Lua / Contra-luz)
        vec3 lightDir2 = normalize(u_lightDirection2);
        float diff2 = max(dot(normal, lightDir2), 0.0);
        float spec2 = 0.0;
        if (diff2 > 0.0) {
            vec3 halfVector2 = normalize(lightDir2 + surfaceToView);
            spec2 = pow(max(dot(normal, halfVector2), 0.0), 50.0); // Brilho
        }
        
        // Combina ambiente + difusa + specular
        vec3 lighting = u_ambientColor + 
                        (u_lightColor1 * diff1) + (u_lightColor1 * spec1) +
                        (u_lightColor2 * diff2) + (u_lightColor2 * spec2);

        vec4 baseColor;
        
        if (u_isTextured) {
            baseColor = texture2D(u_texture, v_texcoord);
        } else if (u_useVertexColor) {
            baseColor = vec4(v_color, 1.0);
        } else {
            baseColor = vec4(u_color, 1.0);
        }

        gl_FragColor = vec4(baseColor.rgb * lighting, 1.0);
    }
`;
