import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isChanged, restoreRegion, unrotatePoint, displaySize, intersects } from '../services/pdf/model.ts';
const style = { fontFamily:'Noto Sans', fontSize:12, bold:false, italic:false, color:'#123456', letterSpacing:0, baseline:10 };
const rect = { x:20, y:30, width:70, height:16 };
const original = () => ({ ...rect, id:'word', text:'İstanbul', style:{...style}, source:'ocr', confidence:95, background:'#f5f0d8', complexBackground:false, original:{rect:{...rect},text:'İstanbul',style:{...style}} });
test('detection and selection leave a region unchanged', () => assert.equal(isChanged(original()), false));
test('style-only changes, empty text, movement and deletion are tracked', () => {
  for (const updates of [{text:''},{x:23},{deleted:true},{width:80},{style:{...style,color:'#ffffff'}},{style:{...style,bold:true}},{style:{...style,letterSpacing:1}}]) assert.equal(isChanged({...original(),...updates}),true);
});
test('restoring resets text, style, geometry and deletion', () => {
  const restored=restoreRegion({...original(),text:'Yeni',x:99,deleted:true,style:{...style,fontSize:30}});
  assert.equal(isChanged(restored),false); assert.equal(restored.text,'İstanbul'); assert.equal(restored.x,20); assert.equal(restored.deleted,false);
});
test('new text is always exported', () => { const region=original(); delete region.original; assert.equal(isChanged(region),true); });
test('all quarter-turns map pointer positions back to PDF points', () => {
  const cases=[[0,20,30],[90,270,20],[180,400,270],[270,30,400]];
  for(const [rotation,x,y] of cases) assert.deepEqual(unrotatePoint(x,y,{width:420,height:300,rotation}),{x:20,y:30});
});
test('rotated display dimensions match the page', () => {
  assert.deepEqual(displaySize({width:420,height:300,rotation:90}),{width:300,height:420});
  assert.deepEqual(displaySize({width:420,height:300,rotation:180}),{width:420,height:300});
});
test('mixed page overlap avoids duplicate OCR without merging adjacent words', () => {
  assert.equal(intersects(rect,{...rect,x:30}),true); assert.equal(intersects(rect,{...rect,x:90}),false);
});
