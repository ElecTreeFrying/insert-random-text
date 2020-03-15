import { lorem } from './lorem';
import { Config } from './config-retrival';

const SINGLE_QUOTES = "\'";
const DOUBLE_QUOTES = "\"";

export class InsertText {

  chance: any;
  quote: string;
  nl: string;
  type: number;
  param: Config;

  constructor(param: Config, chance: any = null, type: number = 0) {
    this.chance = chance;
    this.quote = param.withQuote ? param.quoteStyle ? SINGLE_QUOTES : DOUBLE_QUOTES : '';
    this.nl = param.withNewLine ? '\n' : '';
    this.type = type;
    this.param = param;
  }

  get animal() {
    const types = [ 'Ocean', 'Desert', 'Grassland', 'Forest', 'Farm', 'Pet', 'Zoo' ];
		const randomInt = this.chance.integer({ min: 0, max: 6 });
		const type = types[randomInt];
		let random = this.chance.animal({ type });
        random = `${this.quote}${random}${this.quote}${this.nl}`;

    return { random, type };
  }

  get person() {
    const random = this.chance.name({ full: true });
    return `${this.quote}${random}${this.quote}${this.nl}`;
  }

  get date() {
    const random = this.chance.date().toString();
    return `${this.quote}${random}${this.quote}${this.nl}`;
  }

  get country() {
    const random = this.chance.country({ full: true });
    return `${this.quote}${random}${this.quote}${this.nl}`;
  }

  get number() {
    const random = this.chance.integer({ min: 0, max: 1000 }).toString();
    return `${this.quote}${random}${this.quote}${this.nl}`;
  }

  get string() {
    const random = this.chance.string({ alpha: true, symbols: true, length: 15 });
    return `${this.quote}${random}${this.quote}${this.nl}`;
  }

  get lorem() {
		const random = lorem.substring(0, this.param.loremSize);
    return `${this.quote}${random}${this.quote}${this.nl}`;
  }

  get loremSmall() {
    const random = lorem.substring(0, 177);
    return `${this.quote}${random}${this.quote}${this.nl}`;
  }

  get loremMedium() {
    const random = lorem.substring(0, 521);
    return `${this.quote}${random}${this.quote}${this.nl}`;
  }

  get loremLarge() {
    const random = lorem.substring(0, 1368);
    return `${this.quote}${random}${this.quote}${this.nl}`;
  }

  get hash() {
    return {
      plain: () => {
        const random = this.chance.hash({ length: this.param.hashSize })
        return `${this.quote}${random}${this.quote}${this.nl}`; },
      small: () => {
        const random = this.chance.hash({ length: 7 })
        return `${this.quote}${random}${this.quote}${this.nl}`; },
      medium: () => {
        const random = this.chance.hash({ length: 17 })
        return `${this.quote}${random}${this.quote}${this.nl}`; },
      large: () => {
        const random = this.chance.hash({ length: 27 })
        return `${this.quote}${random}${this.quote}${this.nl}`; },
    };
  }

}
