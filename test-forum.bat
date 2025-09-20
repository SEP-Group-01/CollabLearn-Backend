echo "Testing Forum Service Build..."
cd "c:\Users\94764\Desktop\study\CollabLearn-Backend"
echo "Building forum service..."
npm run build:forum-service
if %errorlevel% equ 0 (
    echo "✅ Build successful! Starting the service..."
    npm run start:forum-service
) else (
    echo "❌ Build failed. Please check the errors above."
    pause
)
