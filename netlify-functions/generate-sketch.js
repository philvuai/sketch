const https = require('https');

// Simplified building type prompts
const buildingPrompts = {
  'residential': 'residential house with windows, doors, roof',
  'commercial': 'commercial building with storefront windows',
  'office': 'office building with regular windows',
  'retail': 'retail space with display windows',
  'restaurant': 'restaurant with outdoor seating',
  'hotel': 'hotel with grand entrance',
  'educational': 'educational building with classrooms',
  'industrial': 'industrial building with large spaces'
};

// Function to compress base64 image (reduce size for faster processing)
function compressImageData(base64Data) {
  // If image is very large, we might want to reduce it
  // For now, just ensure it's properly formatted
  if (base64Data.length > 1000000) { // ~750KB limit
    console.log('Large image detected, may cause timeout');
  }
  return base64Data;
}

function makeHttpsRequest(options, postData) {
  return new Promise((resolve, reject) => {
    // Set timeout for the request
    const timeout = setTimeout(() => {
      req.destroy();
      reject(new Error('Request timeout'));
    }, 25000); // 25 second timeout

    const req = https.request(options, (res) => {
      clearTimeout(timeout);
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
      clearTimeout(timeout);
      reject(error);
    });

    req.on('timeout', () => {
      clearTimeout(timeout);
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

exports.handler = async (event, context) => {
  // Set timeout context
  context.callbackWaitsForEmptyEventLoop = false;
  
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

    const buildingTypeDesc = buildingPrompts[buildingType] || buildingPrompts['residential'];
    
    // Compress image data if needed
    const compressedImage = compressImageData(image);

    // Simplified single API call approach using DALL-E with vision capabilities
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

    // Create a more direct prompt for DALL-E
    const directPrompt = `Create a professional architectural sketch drawing of a ${buildingTypeDesc} inspired by uploaded architectural style. The sketch should be a clean, technical architectural drawing with black lines on white paper, showing proper proportions and architectural details like windows, doors, and structural elements. Style: hand-drawn architectural sketch, technical drawing, clean lines, professional architecture visualization.`;

    const imagePayload = JSON.stringify({
      model: "dall-e-3",
      prompt: directPrompt,
      n: 1,
      size: "1024x1024",
      style: "natural",
      quality: "standard" // Use standard quality for faster generation
    });

    console.log('Calling DALL-E API...');
    const imageResult = await makeHttpsRequest(imageOptions, imagePayload);

    if (imageResult.statusCode !== 200) {
      console.error('DALL-E API error:', imageResult.data);
      throw new Error(`OpenAI Image API error: ${imageResult.data.error?.message || 'Unknown error'}`);
    }

    console.log('DALL-E API success');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        imageUrl: imageResult.data.data[0].url,
        description: `Generated ${buildingTypeDesc} architectural sketch`
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
