const fs = require('fs');
const path = require('path');

const dir = '/home/david/Desktop/personal/docker-programs/n8n/bot/cur-workflows';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.includes('.bak'));

// Mapping of HTTP request names to Native Node configs
const replacements = {
  'Trello Cards': {
    type: 'n8n-nodes-base.trello',
    typeVersion: 1,
    parameters: { resource: 'card', operation: 'getAll', limit: 100 },
    credentials: { trelloApi: { id: '', name: 'Trello account' } }
  },
  'Trello Lists': {
    type: 'n8n-nodes-base.trello',
    typeVersion: 1,
    parameters: { resource: 'list', operation: 'getAll', limit: 100 },
    credentials: { trelloApi: { id: '', name: 'Trello account' } }
  },
  'Gemini Chat': {
    type: 'n8n-nodes-base.googleGemini',
    typeVersion: 1,
    parameters: { resource: 'text', operation: 'generate', prompt: '={{ $json.prompt }}' },
    credentials: { googleGeminiApi: { id: '', name: 'Google Gemini account' } }
  },
  'Gemini Análisis': {
    type: 'n8n-nodes-base.googleGemini',
    typeVersion: 1,
    parameters: { resource: 'text', operation: 'generate', prompt: '={{ $json.prompt }}' },
    credentials: { googleGeminiApi: { id: '', name: 'Google Gemini account' } }
  },
  'Gemini Executive Summary': {
    type: 'n8n-nodes-base.googleGemini',
    typeVersion: 1,
    parameters: { resource: 'text', operation: 'generate', prompt: '={{ $json.prompt }}' },
    credentials: { googleGeminiApi: { id: '', name: 'Google Gemini account' } }
  },
  'Gemini Event Analysis': {
    type: 'n8n-nodes-base.googleGemini',
    typeVersion: 1,
    parameters: { resource: 'text', operation: 'generate', prompt: '={{ $json.prompt }}' },
    credentials: { googleGeminiApi: { id: '', name: 'Google Gemini account' } }
  }
};

files.forEach(file => {
  const filePath = path.join(dir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let modified = false;

  data.nodes = data.nodes.map(node => {
    if (node.type === 'n8n-nodes-base.httpRequest' && replacements[node.name]) {
      modified = true;
      const rep = replacements[node.name];
      // Keep ID, Position, Name
      return {
        id: node.id,
        name: node.name,
        type: rep.type,
        typeVersion: rep.typeVersion,
        position: node.position,
        parameters: rep.parameters,
        credentials: rep.credentials
      };
    }
    
    // Improve Prompt Nodes
    if (node.type === 'n8n-nodes-base.code') {
      if (node.name === 'Construir Contexto' || node.name === 'Preparar Prompt' || node.name === 'Build Report Data' || node.name === 'Delta Detector') {
        let code = node.parameters.jsCode;
        if (code.includes('Eres asistente experto de gestion') || code.includes('Eres gestor PM')) {
          code = code.replace(/Eres asistente experto de gestion del proyecto PetSafe\. Copiloto del gestor para decisiones\./,
            'Eres un PROJECT MANAGER EXPERTO (PM/Agente de IA) del proyecto PetSafe. Tu objetivo es maximizar la eficiencia, reducir riesgos y facilitar la toma de decisiones estratégicas de alto nivel.');
          code = code.replace(/Eres gestor PM del proyecto PetSafe/,
            'Eres el PROJECT MANAGER ESTRATÉGICO del proyecto PetSafe');
            
          code = code.replace(/4\. Si preguntan que hacer.*/, 
            '4. RECOMENDACIONES ESTRATÉGICAS: En lugar de dar consejos genéricos, asigna acciones concretas a personas específicas basándote en la carga de trabajo y los cuellos de botella detectados. Prioriza el ROI del esfuerzo.');
          code = code.replace(/ACCIONES: 3 acciones concretas.*/,
            'ACCIONES: 3 directrices ejecutivas con asignación de recursos, basadas en cuellos de botella reales.');
            
          node.parameters.jsCode = code;
          modified = true;
        }
      }
    }
    
    return node;
  });

  if (modified) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Updated ${file}`);
  }
});
