import { IWaterfall, IWaterfallSpanOrTransaction } from './waterfall/waterfall_helpers/waterfall_helpers';

export const calculateCriticalPath = (waterfall: IWaterfall) => {
  if(waterfall.entryWaterfallTransaction){
    const start = waterfall.entryWaterfallTransaction.offset + waterfall.entryWaterfallTransaction.skew;
    criticalPathForItem(waterfall, 
      waterfall.entryWaterfallTransaction, 
      start, 
      start + waterfall.entryWaterfallTransaction.duration);
  }

};

const criticalPathForItem = ( waterfall: IWaterfall,item: IWaterfallSpanOrTransaction, start: number, end: number, parent?: IWaterfallSpanOrTransaction ) => {
  if(parent) {
    addSegmentToItem(parent, start, end - start, true);
  }

  const directChildren = waterfall.childrenByParentId[item.id];

  if(directChildren && directChildren.length > 0){
    const orderedChildren = [...directChildren].sort((a,b) => (b.offset + b.skew + b.duration) - (a.offset + a.skew + a.duration));
    var scanTimestamp = end;
    orderedChildren.forEach(child => {
      const childStart = Math.max(child.offset + child.skew, start);
      const childEnd = Math.min(child.offset + child.skew + child.duration, scanTimestamp);
      if(childStart >= scanTimestamp) {
        // ignore this child as it is not on the critical path
      } else {
        if(childEnd < scanTimestamp - 1000){
          addSegmentToItem(item, childEnd, scanTimestamp - childEnd, false);
        }
        criticalPathForItem(waterfall, child, childStart, childEnd, item);
        scanTimestamp = childStart;
      }
    });
    if(scanTimestamp > start){
      addSegmentToItem(item, start, scanTimestamp - start, false);
    }
  } else {
    addSegmentToItem(item, start, end - start, false);
  }
};

const addSegmentToItem = (item: IWaterfallSpanOrTransaction, offset: number, duration: number, isChildPath: boolean) => {
    if(duration > 100){
      if(!item.criticalPath) {
        item.criticalPath = [];
      }
      item.criticalPath.push({
        offset: offset,
        duration: duration,
        isChildPath: isChildPath,
      });
    } 
};