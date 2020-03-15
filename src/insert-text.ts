import { lorem } from './lorem';
import { Config } from './config-retrival';

const SINGLE_QUOTES = "\'";
const DOUBLE_QUOTES = "\"";

export class InsertText {

  chance: any;
  quote: string;
  type: number;
  param: Config;

  constructor(param: Config, chance: any = null, type: number = 0) {
    this.chance = chance;
    this.quote = param.withQuote ? param.quoteStyle ? SINGLE_QUOTES : DOUBLE_QUOTES : '';
    this.type = type;
    this.param = param;
  }

  get animal() {
    const types = [ 'Ocean', 'Desert', 'Grassland', 'Forest', 'Farm', 'Pet', 'Zoo' ];
		const randomInt = this.chance.integer({ min: 0, max: 6 });
		const type = types[randomInt];
		let random = this.chance.animal({ type });
        random = `${this.quote}${random}${this.quote}\n`;

    return { random, type };
  }

  get person() {
    const random = this.chance.name({ full: true });
    return `${this.quote}${random}${this.quote}\n`;
  }

  get date() {
    const random = this.chance.date().toString();
    return `${this.quote}${random}${this.quote}\n`;
  }

  get country() {
    const random = this.chance.country({ full: true });
    return `${this.quote}${random}${this.quote}\n`;
  }

  get number() {
    const random = this.chance.integer({ min: 0, max: 1000 }).toString();
    return `${this.quote}${random}${this.quote}\n`;
  }

  get string() {
    const random = this.chance.string({ alpha: true, symbols: true, length: 15 });
    return `${this.quote}${random}${this.quote}\n`;
  }

  get lorem() {
		const random = lorem.substring(0, this.param.loremSize);
    return `${this.quote}${random}${this.quote}\n`;
  }

  get loremSmall() {
    const random = lorem.substring(0, 177);
    return `${this.quote}${random}${this.quote}\n`;
  }

  get loremMedium() {
    const random = lorem.substring(0, 521);
    return `${this.quote}${random}${this.quote}\n`;
  }

  get loremLarge() {
    const random = lorem.substring(0, 1368);
    return `${this.quote}${random}${this.quote}\n`;
  }

  get hash() {
    return {
      plain: () => {
        const random = this.chance.hash({ length: this.param.hashSize })
        return `${this.quote}${random}${this.quote}\n`; },
      small: () => {
        const random = this.chance.hash({ length: 7 })
        return `${this.quote}${random}${this.quote}\n`; },
      medium: () => {
        const random = this.chance.hash({ length: 17 })
        return `${this.quote}${random}${this.quote}\n`; },
      large: () => {
        const random = this.chance.hash({ length: 27 })
        return `${this.quote}${random}${this.quote}\n`; },
    };
  }

}
