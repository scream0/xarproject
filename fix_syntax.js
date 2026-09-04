const fs = require('fs');


const brokenFiles = [
  'src/components/Dashboard/Admin/Analytics/AnalyticsChart.tsx',
  'src/components/Dashboard/Admin/Chat/AdminChatView.tsx',
  'src/components/Dashboard/Admin/Notifications/NotificationCenter.tsx',
  'src/components/Dashboard/Admin/Orders/OrdersManagement.tsx',
  'src/components/Dashboard/Admin/Products/ProductForm.tsx',
  'src/components/Dashboard/Admin/Products/ProductManager.tsx',
  'src/components/Dashboard/User/Chat/UserChatModal.tsx',
  'src/components/Dashboard/User/Notifications/NotificationsSection.tsx',
  'src/components/Dashboard/User/Settings/UserSettings.tsx'
];

brokenFiles.forEach(file => {
    try {
        let content = fs.readFileSync(file, 'utf8');
        
        // Fix missing parens for arrow functions: e.g. tx: any => 
        // to (tx: any) =>
        content = content.replace(/\b([a-zA-Z0-9_]+):\s*any\s*=>/g, '($1: any) =>');
        
        // Let's also check if there are other errors like TS2657 (which usually means bad brackets).
        // I'll just write it back and let's re-check the build.
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Fixed syntax in ${file}`);
    } catch (e) {
        console.error(e);
    }
});
