process.env.RAZORPAY_KEY_ID='rzp_test_abc123'; process.env.RAZORPAY_KEY_SECRET='testsecret';
process.env.SUPABASE_URL='http://127.0.0.1:1'; process.env.SUPABASE_SERVICE_ROLE_KEY='x';
const assert=require('assert'); const crypto=require('crypto');
const v=require(require('path').join(__dirname,'../../backend/src/utils/validation'));
const pay=require(require('path').join(__dirname,'../../backend/src/services/paymentService'));
const {extractBudget,detectCategory}=require(require('path').join(__dirname,'../../backend/src/services/aiService'));
const {generateOrderPdf}=require(require('path').join(__dirname,'../../backend/src/services/pdfService'));
// discount
assert.strictEqual(v.discountPercent(14999,30999),51); assert.strictEqual(v.discountPercent(100,100),0); assert.strictEqual(v.discountPercent(100,90),0); assert.strictEqual(v.discountPercent(99,100),1);
// stock
assert.strictEqual(v.stockStatus(0),'out_of_stock'); assert.strictEqual(v.stockStatus(5),'low_stock'); assert.strictEqual(v.stockStatus(6),'in_stock');
// cart
const id='11111111-1111-4111-8111-111111111111';
assert.deepStrictEqual(v.validateCartItems([{product_id:id,quantity:1},{product_id:id,quantity:2}]),[{product_id:id,quantity:3}]);
assert.throws(()=>v.validateCartItems([{product_id:id,quantity:11}])); assert.throws(()=>v.validateCartItems([{product_id:'x',quantity:1}])); assert.throws(()=>v.validateCartItems([]));
// address
assert.throws(()=>v.validateAddress({full_name:'A',phone:'123'}));
assert.ok(v.validateAddress({full_name:'Ravi Kumar',phone:'9876543210',line1:'12 Main Road',city:'Hyderabad',state:'Telangana',pincode:'500001'}));
// razorpay signature
const sig=crypto.createHmac('sha256','testsecret').update('order_1|pay_1').digest('hex');
assert.ok(pay.verifyCheckoutSignature('order_1','pay_1',sig)); assert.ok(!pay.verifyCheckoutSignature('order_1','pay_2',sig)); assert.ok(!pay.verifyCheckoutSignature('order_1','pay_1','bad'));
// ai helpers
assert.strictEqual(extractBudget('laptop under 50,000'),50000); assert.strictEqual(extractBudget('phone below 20k'),20000); assert.strictEqual(detectCategory('best laptop'),'Laptops');
// pdf
generateOrderPdf({order_number:'EM261018-ABC123',created_at:new Date().toISOString(),payment_method:'cod',payment_status:'cod_due',order_status:'confirmed',subtotal:2499,discount:0,shipping_charge:99,tax:0,total:2598,shipping_address:{full_name:'Ravi',line1:'12 Main Road',city:'Hyd',state:'TS',pincode:'500001',phone:'9876543210'},order_items:[{product_name:'Demo Headphones',quantity:1,unit_price:2499,line_total:2499}]},{email:'a@b.com'}).then(b=>{assert.ok(b.slice(0,4).toString()==='%PDF'); require('fs').writeFileSync(require('os').tmpdir()+'/em-sample.pdf',b); console.log('PDF bytes',b.length);
 // boot server & hit endpoints
 const app=require(require('path').join(__dirname,'../../backend/server.js')); const s=app.listen(0,async()=>{const p=s.address().port; const get=async(u,o)=>{const r=await fetch(`http://127.0.0.1:${p}${u}`,o);return [r.status,await r.json().catch(()=>null)]};
  console.log('health',await get('/api/health')); console.log('config',(await get('/api/config'))[0]);
  console.log('orders no auth',await get('/api/orders')); console.log('admin no auth',await get('/api/admin/analytics'));
  console.log('bad cors',(await fetch(`http://127.0.0.1:${p}/api/config`,{headers:{Origin:'http://evil.com'}})).status);
  console.log('ai empty',await get('/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}));
  s.close(); console.log('ALL ASSERTIONS PASSED'); process.exit(0);});
}).catch(e=>{console.error(e);process.exit(1)});
