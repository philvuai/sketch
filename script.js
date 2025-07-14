document.addEventListener('DOMContentLoaded', function () {
    const imageInput = document.getElementById('imageInput');
    const uploadArea = document.getElementById('uploadArea');
    const imagePreview = document.getElementById('imagePreview');
    const outputType = document.getElementById('outputType');
    const generateBtn = document.getElementById('generateBtn');
    const loader = document.getElementById('loader');
    const resultImage = document.getElementById('resultImage');
    const resultSection = document.getElementById('resultSection');
    const downloadBtn = document.getElementById('downloadBtn');
    const regenerateBtn = document.getElementById('regenerateBtn');

    uploadArea.addEventListener('click', () => imageInput.click());

    imageInput.addEventListener('change', handleImageUpload);
    outputType.addEventListener('change', handleOutputChange);
    generateBtn.addEventListener('click', generateSketch);

    function handleImageUpload(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                imagePreview.innerHTML = `<img src="${e.target.result}" alt="Image Preview" class="uploaded-image" />`;
                enableGenerateButton();
            };
            reader.readAsDataURL(file);
        }
    }

    function handleOutputChange() {
        enableGenerateButton();
    }

    function enableGenerateButton() {
        generateBtn.disabled = !(imagePreview.innerHTML && outputType.value);
    }

    async function generateSketch() {
        loader.style.display = 'block';
        generateBtn.disabled = true;

        const imageData = imagePreview.querySelector('img').src;
        const outputSelected = outputType.value;

        try {
            const response = await fetch('/.netlify/functions/generate-sketch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    image: imageData,
                    buildingType: outputSelected
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate sketch.');
            }

            const result = await response.json();
            resultImage.innerHTML = `<img src="${result.imageUrl}" alt="Generated Sketch" class="result-image-display" />`;
            resultSection.style.display = 'block';
        } catch (error) {
            console.error('Error generating sketch:', error);
            alert('Error: ' + error.message);
        } finally {
            loader.style.display = 'none';
            generateBtn.disabled = false;
        }
    }

    downloadBtn.addEventListener('click', () => {
        if (resultImage.querySelector('img')) {
            const sketchUrl = resultImage.querySelector('img').src;
            const a = document.createElement('a');
            a.href = sketchUrl;
            a.download = 'generated-sketch.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    });

    regenerateBtn.addEventListener('click', () => {
        resultSection.style.display = 'none';
        generateSketch();
    });
});
