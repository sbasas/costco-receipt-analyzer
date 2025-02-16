import { 
  TextractClient, 
  AnalyzeDocumentCommand,
  Block 
} from "@aws-sdk/client-textract";
import { 
  TimestreamWriteClient, 
  WriteRecordsCommand,
  _Record,
  Dimension,
  MeasureValueType
} from "@aws-sdk/client-timestream-write";

const textractClient = new TextractClient({ region: process.env.AWS_REGION });
const timestreamClient = new TimestreamWriteClient({ region: process.env.AWS_REGION });

interface ReceiptItem {
  itemNumber: string;
  itemName: string;
  price: number;
}

export const handler = async (event: any) => {
  try {
    console.log('Processing event:', JSON.stringify(event, null, 2));

    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
    const userId = key.split('/')[0];

    console.log(`Processing receipt for user ${userId} from ${bucket}/${key}`);

    const analyzeCommand = new AnalyzeDocumentCommand({
      Document: {
        S3Object: {
          Bucket: bucket,
          Name: key
        }
      },
      FeatureTypes: ['FORMS', 'TABLES']
    });

    const textractResponse = await textractClient.send(analyzeCommand);
    
    if (!textractResponse.Blocks || textractResponse.Blocks.length === 0) {
      console.log('No text blocks found in the document');
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'No text found in document' })
      };
    }

    // Extract all text lines from the document
    const lines: string[] = [];
    textractResponse.Blocks.forEach(block => {
      if (block.BlockType === 'LINE' && block.Text) {
        lines.push(block.Text.trim());
        console.log('Found line:', block.Text.trim());
      }
    });

    console.log(`Found ${lines.length} lines of text`);

    // Process lines to extract items
    const items: ReceiptItem[] = [];
    
    for (let i = 0; i < lines.length - 1; i++) {
      const currentLine = lines[i];
      const nextLine = lines[i + 1];

      if (!currentLine || !nextLine) {
        console.log('Skipping undefined line at index:', i);
        continue;
      }

      console.log('Processing line pair:', { currentLine, nextLine });

      // Match item number and name (e.g., "48757 SPRING MIX")
      const itemMatch = currentLine.match(/^(\d+)\s+(.+)$/);
      
      if (itemMatch) {
        // Check if next line contains the price (e.g., "3.89 3")
        const priceMatch = nextLine.match(/^(\d+[.,]\d{2})\s*\d?$/);
        
        if (priceMatch) {
          const [, itemNumber, itemName] = itemMatch;
          const price = parseFloat(priceMatch[1].replace(',', '.'));

          // Skip if line contains "TOTAL" or other summary keywords
          if (!itemName.includes('TOTAL') && 
              !itemName.includes('SUBTOTAL') && 
              !itemName.includes('TAX')) {
            
            const item = {
              itemNumber,
              itemName: itemName.trim(),
              price
            };

            items.push(item);
            console.log('Extracted item:', item);
          }
        }
      }
    }

    console.log('Extracted items:', JSON.stringify(items, null, 2));

    if (items.length > 0) {
      const currentTime = Date.now().toString();
      
      const records: _Record[] = items.map(item => ({
        Dimensions: [
          { Name: 'user_id', Value: userId } as Dimension,
          { Name: 'item_number', Value: item.itemNumber } as Dimension,
          { Name: 'item_name', Value: item.itemName } as Dimension
        ],
        MeasureName: 'price',
        MeasureValue: item.price.toString(),
        MeasureValueType: MeasureValueType.DOUBLE,
        Time: currentTime
      }));

      const writeCommand = new WriteRecordsCommand({
        DatabaseName: process.env.TIMESTREAM_DATABASE_NAME,
        TableName: process.env.TIMESTREAM_TABLE_NAME,
        Records: records
      });

      await timestreamClient.send(writeCommand);
      console.log('Successfully saved items to Timestream');
    } else {
      console.log('No items were extracted from the receipt');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Receipt processed successfully',
        itemCount: items.length,
        items: items
      })
    };
  } catch (error) {
    console.error('Error processing receipt:', error);
    throw error;
  }
};