import { Ticker, Trade } from "./types";

export const BASE_URL = "wss://ws.backpack.exchange";

export class ConnectionManager {
  private ws: WebSocket;
  private static instance: ConnectionManager;
  private bufferedMessages: any[] = [];
  private callbacks: any = {};
  private id: number;
  private initialized: boolean = false;

  private constructor() {
    this.ws = new WebSocket(BASE_URL);
    this.bufferedMessages = [];
    this.id = 1;
    this.init();
  }

  public static getInstance() {
    if (!this.instance) {
      this.instance = new ConnectionManager();
    }
    return this.instance;
  }

  init() {
    this.ws.onopen = () => {
      this.initialized = true;
      this.bufferedMessages.forEach((message) => {
        this.ws.send(JSON.stringify(message));
      });
      this.bufferedMessages = [];
      console.log("initialized");
    };
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      // console.log("hii from server");
      // console.log(message);
      const type = message.data.e;
      if(this.callbacks[type]){
        this.callbacks[type].forEach(
          ({ callback }: { callback: (...args: any[]) => void }) => {
            if (type === "ticker") {
              const newTicker: Partial<Ticker> = {
                lastPrice: message.data.c,
                high: message.data.h,
                low: message.data.l,
                volume: message.data.v,
                quoteVolume: message.data.V,
                symbol: message.data.s,
              };

              callback(newTicker);
            } else if (type === "depth") {
              const updatedBids = message.data.b;
              const updatedAsks = message.data.a;
              callback({ bids: updatedBids, asks: updatedAsks });
            } else if (type === "trade") {
              // E: 1750178488219634;
              // T: 1750178488214000;
              // a: "2005085300";
              // b: "2005086164";
              // e: "trade";
              // m: false;
              // p: "147.67";
              // q: "6.36";
              // s: "SOL_USDC";
              // t: 358343642;

              const newTrade: Partial<Trade> = {
                id: message.data.t,
                isBuyerMaker: message.data.m,
                price: message.data.p,
                quantity: message.data.q,
                timestamp: message.data.t,
              };
              callback(newTrade);
            }
          }
        );
      }
    };
  }

  sendMessage(message: any) {
    console.log("sending..");
    const messageToSend = {
      ...message,
      id: this.id++,
    };
    if (!this.initialized) {
      this.bufferedMessages.push(messageToSend);
      return;
    }
    this.ws.send(JSON.stringify(messageToSend));
    console.log("sent");
  }
  async registerCallback(type: string, callback: any, id: string) {
    this.callbacks[type] = this.callbacks[type] || [];
    this.callbacks[type].push({ callback, id });
  }
  async deRegisterCallback(type: string, id: string){
    if(this.callbacks[type]){
      const index = this.callbacks[type].findIndex(
        (callback: { id: string }) => callback.id === id
      );

      if(index != -1){
        this.callbacks[type].splice(index,1);
      }
    }
  }
}
