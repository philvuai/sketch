const https = require('https');

// Building type prompts for different architectural styles
const buildingPrompts = {
  'residential': 'Create a detailed architectural sketch of a residential house in the style of the uploaded image. Focus on residential features like windows, doors, rooflines, and landscaping elements. Make it look like a professional architectural drawing with clean lines and proper proportions.',
  'commercial': 'Create a detailed architectural sketch of a commercial building in the style of the uploaded image. Focus on commercial features like storefront windows, signage areas, and customer entrances. Make it look like a professional architectural drawing with clean lines and proper proportions.',
  'office': 'Create a detailed architectural sketch of an office building in the style of the uploaded image. Focus on office features like regular window patterns, entrance lobbies, and professional facades. Make it look like a professional architectural drawing with clean lines and proper proportions.',
  'retail': 'Create a detailed architectural sketch of a retail space in the style of the uploaded image. Focus on retail features like large display windows, customer entrances, and attractive storefronts. Make it look like a professional architectural drawing with clean lines and proper proportions.',
  'restaurant': 'Create a detailed architectural sketch of a restaurant building in the style of the uploaded image. Focus on restaurant features like outdoor seating areas, welcoming entrances, and dining ambiance. Make it look like a professional architectural drawing with clean lines and proper proportions.',
  'hotel': 'Create a detailed architectural sketch of a hotel building in the style of the uploaded image. Focus on hotel features like grand entrances, multiple floors, and hospitality design elements. Make it look like a professional architectural drawing with clean lines and proper proportions.',
  'educational': 'Create a detailed architectural sketch of an educational building in the style of the uploaded image. Focus on educational features like classrooms, hallways, and learning environments. Make it look like a professional architectural drawing with clean lines and proper proportions.',
  'industrial': 'Create a detailed architectural sketch of an industrial building in the style of the uploaded image. Focus on industrial features like large open spaces, loading docks, and functional design elements. Make it look like a professional architectural drawing with clean lines and proper proportions.'
};

function makeHttpsRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            data: parsedData
          });
        } catch (error) {
          reject(new Error(`Failed to parse JSON response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { image, buildingType } = JSON.parse(event.body);

    if (!image || !buildingType) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required parameters: image and buildingType' })
      };
    }

    if (!process.env.OPENAI_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'OpenAI API key not configured' })
      };
    }

    const prompt = buildingPrompts[buildingType] || buildingPrompts['residential'];

    // First, analyze the image to understand the architectural style
    const analysisOptions = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    };

    const analysisPayload = JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this architectural image and describe the key architectural style elements, materials, and design features. Then ${prompt}`
            },
            {
              type: "image_url",
              image_url: {
                url: image
              }
            }
          ]
        }
      ],
      max_tokens: 300
    });

    const analysisResult = await makeHttpsRequest(analysisOptions, analysisPayload);

    if (analysisResult.statusCode !== 200) {
      throw new Error(`OpenAI API error: ${analysisResult.data.error?.message || 'Unknown error'}`);
    }

    const styleDescription = analysisResult.data.choices[0].message.content;

    // Now generate the sketch using DALL-E
    const imageOptions = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/images/generations',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    };

    const imagePayload = JSON.stringify({
      model: "dall-e-3",
      prompt: `Create a detailed architectural sketch drawing based on this description: ${styleDescription}. The sketch should be in a professional architectural drawing style with clean lines, proper proportions, and technical drawing aesthetics. Make it look like a hand-drawn architectural sketch with black lines on white paper.`,
      n: 1,
      size: "1024x1024",
      style: "natural"
    });

    const imageResult = await makeHttpsRequest(imageOptions, imagePayload);

    if (imageResult.statusCode !== 200) {
      throw new Error(`OpenAI Image API error: ${imageResult.data.error?.message || 'Unknown error'}`);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        imageUrl: imageResult.data.data[0].url,
        description: styleDescription
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
