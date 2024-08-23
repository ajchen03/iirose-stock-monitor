import { Context, Logger, Schema } from 'koishi';
import { StockSession } from 'koishi-plugin-adapter-iirose';
import { Stock } from 'koishi-plugin-adapter-iirose/lib/decoder/Stock';

export const name = 'iirose-stock-monitor';

export interface Config { }

export const Config: Schema<Config> = Schema.object({});

export function apply(ctx: Context) {
  let tempData: Record<string, {
    nowData?: Stock;
    status: { down: number, up: number, baseMoney: number, unitPrice: number, lastBaseMoney: number, has: number, new: number; };
    isOpen: boolean;
    lastBuyPrice?: number; // 新增：上次建议购买时的股价
  }> = {};

  // const logger = new Logger('IIROSE-Stock-Monitor');

  ctx.command('stockMonitor', '花园股票监听器');

  ctx.command('stockMonitor').subcommand('.on', '开启股票监听功能').action(v => {
    if (v.session.platform != "iirose") { return; }
    if (!tempData.hasOwnProperty(v.session.selfId)) {
      tempData[v.session.selfId] = {
        status: {
          down: 0,
          up: 0,
          baseMoney: 0,
          unitPrice: 0,
          lastBaseMoney: 1,
          has: 0,
          new: 0
        },
        isOpen: true
      };
    }

    const thisBotObj = tempData[v.session.selfId];
    thisBotObj.isOpen = true;

    v.session.send(' [stockMonitor] 监听已开启');
  });

  ctx.command('stockMonitor').subcommand('.off', '关闭股票监听功能').action(v => {
    if (v.session.platform != "iirose") { return; }
    if (!tempData.hasOwnProperty(v.session.selfId)) {
      tempData[v.session.selfId] = {
        status: {
          down: 0,
          up: 0,
          baseMoney: 0,
          unitPrice: 0,
          lastBaseMoney: 1,
          has: 0,
          new: 0
        },
        isOpen: false
      };
    }

    const thisBotObj = tempData[v.session.selfId];
    thisBotObj.isOpen = false;

    v.session.send(' [stockMonitor] 监听已关闭');
  });

  ctx.on('iirose/before-getUserList', (session) => {
    if (!tempData.hasOwnProperty(session.selfId)) {
      tempData[session.selfId] = {
        status: {
          down: 0,
          up: 0,
          baseMoney: 0,
          unitPrice: 0,
          lastBaseMoney: 1,
          has: 0,
          new: 0
        },
        isOpen: true
      };
    }

    const thisBotObj = tempData[session.selfId];

    if (!thisBotObj.isOpen) { return; }

    const status = thisBotObj.status;

    session.bot.internal.stockGet(async (data: StockSession) => {
      if (!thisBotObj.nowData) {
        thisBotObj.nowData = data;
        status.baseMoney = data.personalMoney;
        status.unitPrice = 999999;
      }

      if (thisBotObj.nowData == data) {
        return;
      }

      const message = [
        '\\\\\\*',
        '股价提醒'
      ];

      if (data.unitPrice == 1 && data.totalStock == 1000) {
        status.up = 0;
        status.down = 0;
        thisBotObj.nowData = data;
		thisBotObj.lastBuyPrice = 0
        status.has = 0;
        status.new = 1;

        message[2] = `股市崩盘了——（绝望`;
        message[3] = `股价：${data.unitPrice}`;
        message[4] = `总股：${data.totalStock}`;
        message[5] = `总金：${data.totalMoney}`;

        return data.send({
          public: {
            message: message.join('\n')
          }
        });
      }

      if (data.unitPrice > thisBotObj.nowData.unitPrice) {
        status.up++;
        status.down = 0;
        message[2] = `已增加 ${status.up} 次`;
        message[3] = `已增加 ${(data.unitPrice - thisBotObj.nowData.unitPrice).toFixed(3)} | 增幅 +${(((data.unitPrice - thisBotObj.nowData.unitPrice) / thisBotObj.nowData.unitPrice) * 100).toFixed(2)}%`;
      }

      if (data.unitPrice < thisBotObj.nowData.unitPrice) {
        status.up = 0;
        status.down++;
        message[2] = `已降低 ${status.down} 次`;
        message[3] = `已降低 ${(thisBotObj.nowData.unitPrice - data.unitPrice).toFixed(2)} | 降幅 -${(((thisBotObj.nowData.unitPrice - data.unitPrice) / thisBotObj.nowData.unitPrice) * 100).toFixed(2)}%`;
      }

      message[4] = `股价：${data.unitPrice} 钞/股 ${data.unitPrice<=0.1?"!不可购买!":''}`;
      message[5] = `总股：${data.totalStock} 股`;
      message[6] = `总金：${data.totalMoney} 钞`;

      // 新增：建议购买和卖出的逻辑
      if (data.unitPrice > 0.1 && data.unitPrice < 0.2) {
	  	message[7] = ``;
        message[8] = `建议购买！当前股价：${data.unitPrice}`;
        thisBotObj.lastBuyPrice = data.unitPrice; // 记录上次建议购买时的股价
      } else if (data.unitPrice > 0.5) {
	  	message[7] = ``;
        message[8] = `建议卖出！当前股价：${data.unitPrice}`;
        if (thisBotObj.lastBuyPrice && thisBotObj.lastBuyPrice != 0) {
          const profit = (data.unitPrice - thisBotObj.lastBuyPrice) / thisBotObj.lastBuyPrice;
          message[9] = `上次建议购买时买入的话，现在卖出会赚${profit.toFixed(2)}倍`;
        }
      }

      thisBotObj.nowData = data;

      return data.send({
        public: {
          message: message.join('\n')
        }
      });
    });
  });
}
