# Implementation Guide

## Quick Start Implementation

### 1. Project Setup

```bash
# Create new React Native project
npx react-native init BlindOrderProcessor
cd BlindOrderProcessor

# Install dependencies
npm install react-native-document-picker react-native-fs react-native-share react-native-html-to-pdf xlsx buffer

# iOS only
cd ios && pod install && cd ..
```

### 2. File Structure Setup

```
BlindOrderProcessor/
├── src/
│   ├── App.js
│   ├── core/
│   │   ├── cutlistOptimizer.js
│   │   ├── excelOrderParser.js
│   │   └── inventoryManager.js
│   ├── components/
│   │   └── WorksheetPreview.js
│   └── utils/
│       └── exportUtils.js
├── android/
├── ios/
└── package.json
```

### 3. Android Configuration

**android/app/src/main/AndroidManifest.xml**
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.INTERNET" />
    
    <application>
        <!-- Your app config -->
    </application>
</manifest>
```

**android/app/build.gradle**
```gradle
android {
    defaultConfig {
        minSdkVersion 21
        targetSdkVersion 33
    }
}

dependencies {
    implementation 'com.github.gcacace:signature-pad:1.3.1'
}
```

### 4. iOS Configuration

**ios/Podfile**
```ruby
platform :ios, '13.0'

target 'BlindOrderProcessor' do
  # React Native pods
  use_react_native!
  
  # Permissions
  permissions_path = '../node_modules/react-native-permissions/ios'
  pod 'Permission-PhotoLibrary', :path => "#{permissions_path}/PhotoLibrary"
  pod 'Permission-MediaLibrary', :path => "#{permissions_path}/MediaLibrary"
end
```

### 5. Main Entry Point

**index.js**
```javascript
import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
```

## Code Integration Examples

### Example 1: Basic Usage

```javascript
import React, { useState } from 'react';
import { View, Button } from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import ExcelOrderParser from './core/excelOrderParser';
import CutlistOptimizer from './core/cutlistOptimizer';

const SimpleExample = () => {
  const [result, setResult] = useState(null);
  
  const processOrder = async () => {
    // 1. Pick file
    const file = await DocumentPicker.pickSingle({
      type: [DocumentPicker.types.allFiles]
    });
    
    // 2. Parse Excel
    const parser = new ExcelOrderParser();
    const orderData = await parser.parseOrderFile(file);
    
    // 3. Optimize
    const optimizer = new CutlistOptimizer();
    const panels = parser.convertToPanels(orderData.orders);
    const optimization = optimizer.optimize(panels);
    
    // 4. Display results
    setResult(optimization);
  };
  
  return (
    <View>
      <Button title="Process Order" onPress={processOrder} />
      {result && (
        <Text>Efficiency: {result.statistics.efficiency}%</Text>
      )}
    </View>
  );
};
```

### Example 2: With Inventory Management

```javascript
import InventoryManager from './core/inventoryManager';

const WithInventoryExample = () => {
  const inventory = new InventoryManager();
  
  // Initialize inventory
  inventory.addRoll({
    fabricType: 'Blockout',
    colour: 'White',
    width: 3000,
    length: 30000
  });
  
  const processWithInventory = async (orders) => {
    // ... parse and optimize
    
    // Check availability
    const check = inventory.checkAvailability(
      cutlistResult.statistics.usedStockSheets * 10000,
      'Blockout',
      'White'
    );
    
    if (!check.isAvailable) {
      Alert.alert(
        'Insufficient Inventory',
        `Need ${check.shortage}mm more fabric`
      );
      return;
    }
    
    // Deduct if available
    const deduction = inventory.deductFabric(
      cutlistResult,
      'Blockout',
      'White'
    );
    
    console.log('Deducted:', deduction.totalDeducted);
  };
  
  return <ProcessButton onPress={processWithInventory} />;
};
```

### Example 3: Custom Worksheet Generation

```javascript
const generateCustomWorksheet = (orders, cutlistResult) => {
  const worksheet = [];
  
  cutlistResult.sheets.forEach((sheet, sheetIndex) => {
    sheet.panels.forEach((panel, panelIndex) => {
      // Find matching order
      const order = orders.find(o => 
        o.width === panel.width && o.drop === panel.length
      );
      
      if (order) {
        worksheet.push({
          'Sheet': sheetIndex + 1,
          'Panel': panelIndex + 1,
          'Order ID': order.blindNumber,
          'Dimensions': `${panel.width}×${panel.length}`,
          'Position': `(${panel.x}, ${panel.y})`,
          'Rotated': panel.rotated ? 'Yes' : 'No',
          'Fabric': order.fabric,
          'Colour': order.colour,
          'Location': order.location
        });
      }
    });
  });
  
  return worksheet;
};
```

### Example 4: Export with Custom Styling

```javascript
const exportStyledPDF = async (worksheets) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Helvetica', sans-serif; }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        th {
          background: #667eea;
          color: white;
          padding: 12px;
        }
        td {
          padding: 10px;
          border: 1px solid #ddd;
        }
        tr:hover { background: #f5f5f5; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Professional Cutting Worksheet</h1>
        <p>Generated ${new Date().toLocaleDateString()}</p>
      </div>
      ${generateTableHTML(worksheets.fabricCut)}
    </body>
    </html>
  `;
  
  const pdf = await RNHTMLtoPDF.convert({ html });
  return pdf.filePath;
};
```

## Advanced Features

### Custom Optimization Strategy

```javascript
class CustomOptimizer extends CutlistOptimizer {
  constructor(config) {
    super(config);
    this.customStrategy = config.customStrategy || 'balanced';
  }
  
  optimize(panels) {
    // Apply custom pre-processing
    const preprocessed = this.preprocessPanels(panels);
    
    // Run optimization
    const result = super.optimize(preprocessed);
    
    // Apply custom post-processing
    return this.postprocessResult(result);
  }
  
  preprocessPanels(panels) {
    // Example: Group by fabric type first
    const grouped = {};
    panels.forEach(panel => {
      const key = panel.fabricType || 'default';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(panel);
    });
    
    // Flatten back
    return Object.values(grouped).flat();
  }
  
  postprocessResult(result) {
    // Example: Add custom metadata
    result.metadata = {
      strategy: this.customStrategy,
      processedAt: new Date().toISOString(),
      optimizationScore: this.calculateScore(result)
    };
    return result;
  }
  
  calculateScore(result) {
    const efficiency = result.statistics.efficiency;
    const wasteScore = 100 - result.statistics.wastePercentage;
    const sheetsScore = 100 / result.statistics.usedStockSheets;
    
    return (efficiency * 0.5 + wasteScore * 0.3 + sheetsScore * 0.2);
  }
}
```

### Multi-Fabric Support

```javascript
const processMultiFabricOrder = async (orders) => {
  // Group by fabric type
  const byFabric = {};
  orders.forEach(order => {
    const key = `${order.fabric}-${order.colour}`;
    if (!byFabric[key]) byFabric[key] = [];
    byFabric[key].push(order);
  });
  
  // Process each fabric type separately
  const results = {};
  for (const [fabricKey, fabricOrders] of Object.entries(byFabric)) {
    const parser = new ExcelOrderParser();
    const optimizer = new CutlistOptimizer();
    
    const panels = parser.convertToPanels(fabricOrders);
    const optimization = optimizer.optimize(panels);
    
    results[fabricKey] = {
      orders: fabricOrders,
      optimization,
      worksheet: parser.generateFabricCutWorksheet(
        fabricOrders,
        optimization
      )
    };
  }
  
  return results;
};
```

### Real-time Progress Tracking

```javascript
const OptimizeWithProgress = ({ panels, onProgress }) => {
  const optimizeWithTracking = (panels) => {
    const totalPanels = panels.length;
    let processed = 0;
    
    const sheets = [];
    
    panels.forEach((panel, index) => {
      // Place panel
      const placed = this.tryPlacePanel(sheets, panel);
      
      processed++;
      onProgress({
        current: processed,
        total: totalPanels,
        percentage: (processed / totalPanels) * 100
      });
    });
    
    return sheets;
  };
  
  return <OptimizationComponent optimize={optimizeWithTracking} />;
};
```

## Testing

### Unit Tests

**cutlistOptimizer.test.js**
```javascript
import CutlistOptimizer from './cutlistOptimizer';

describe('CutlistOptimizer', () => {
  let optimizer;
  
  beforeEach(() => {
    optimizer = new CutlistOptimizer({
      stockWidth: 3000,
      stockLength: 10000
    });
  });
  
  test('should optimize simple panel layout', () => {
    const panels = [
      { width: 1000, length: 2000, qty: 1, label: '1000x2000' },
      { width: 1500, length: 2500, qty: 1, label: '1500x2500' }
    ];
    
    const result = optimizer.optimize(panels);
    
    expect(result.sheets).toBeDefined();
    expect(result.statistics.totalCuts).toBe(2);
    expect(result.statistics.efficiency).toBeGreaterThan(0);
  });
  
  test('should handle panels exceeding stock width', () => {
    const panels = [
      { width: 3500, length: 2000, qty: 1, label: '3500x2000' }
    ];
    
    const result = optimizer.optimize(panels);
    
    // Should log warning but continue
    expect(result.sheets.length).toBeGreaterThanOrEqual(0);
  });
  
  test('should calculate statistics correctly', () => {
    const panels = [
      { width: 1000, length: 1000, qty: 10, label: '1000x1000' }
    ];
    
    const result = optimizer.optimize(panels);
    
    expect(result.statistics.totalPanels).toBe(10);
    expect(result.statistics.wastePercentage).toBeLessThan(100);
    expect(result.statistics.efficiency).toBeGreaterThan(0);
  });
});
```

## Deployment

### Android Release

```bash
# Generate release APK
cd android
./gradlew assembleRelease

# Find APK at:
# android/app/build/outputs/apk/release/app-release.apk
```

### iOS Release

```bash
# Archive for App Store
cd ios
xcodebuild -workspace BlindOrderProcessor.xcworkspace \
  -scheme BlindOrderProcessor \
  -configuration Release \
  -archivePath build/BlindOrderProcessor.xcarchive \
  archive
```

## Performance Tips

1. **Large Datasets**
   - Use pagination: Process orders in chunks of 50
   - Implement virtual scrolling for worksheets
   - Cache optimization results

2. **Memory Management**
   - Clear old transaction logs periodically
   - Limit worksheet preview rows
   - Use lazy loading for images

3. **Optimization Speed**
   - Set timeout for complex layouts
   - Use web workers for background processing
   - Implement result caching

## Security Considerations

1. **File Upload Validation**
   - Check file size (max 10MB)
   - Validate file extension
   - Scan for macros/malicious content

2. **Data Privacy**
   - Don't store sensitive customer data
   - Clear cache after processing
   - Implement secure storage for inventory

3. **Permissions**
   - Request only necessary permissions
   - Handle permission denials gracefully
   - Explain why permissions are needed

## Troubleshooting Guide

### Issue: "Cannot read Excel file"
**Solution**: Ensure XLSX library is properly installed and file is not password-protected

### Issue: "Optimization takes too long"
**Solution**: Reduce panel count or implement timeout with partial results

### Issue: "Export fails on Android"
**Solution**: Check storage permissions and available disk space

### Issue: "Inventory shows incorrect values"
**Solution**: Verify deduction calculations and transaction log

---

## Next Steps

1. Test with sample Excel file
2. Configure inventory with initial fabric rolls
3. Process test order and review worksheets
4. Export and validate CSV/PDF output
5. Deploy to testing devices
6. Gather user feedback
7. Iterate and improve

For more help, refer to the main README.md
