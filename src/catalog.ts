import { faker } from './engine';

/** A single named data type the extension can generate and insert. */
export interface Generator {
  /** Stable identifier — used in command ids and registry lookup. */
  readonly id: string;
  /** Human-readable label shown in the Quick Pick. */
  readonly label: string;
  /** Quick Pick group heading this generator is listed under. */
  readonly group: string;
  /** When true, hidden from the Quick Pick (a back-compat-only generator). */
  readonly hidden?: boolean;
  /** Produce one fresh value. Called once per cursor — must never be memoized. */
  generate(): string;
}

/**
 * The generator registry — the single source of truth for what the extension can
 * produce. It drives generation, the contributed commands, and the Quick Pick, so
 * adding an entry here surfaces a new type everywhere at once.
 *
 * One unified list grouped by category — each group appears exactly once, in the
 * order its first member is listed (which is the Quick Pick heading order). Add a
 * new type inside its group block. `hidden` entries (the legacy Lorem/Hash size
 * variants) are kept at the very end and never shown in the picker.
 */
export const generators: readonly Generator[] = [
  // Identity
  { id: 'person', label: 'Full Name', group: 'Identity', generate: () => faker().person.fullName() },
  { id: 'firstName', label: 'First Name', group: 'Identity', generate: () => faker().person.firstName() },
  { id: 'middleName', label: 'Middle Name', group: 'Identity', generate: () => faker().person.middleName() },
  { id: 'lastName', label: 'Last Name', group: 'Identity', generate: () => faker().person.lastName() },
  { id: 'prefix', label: 'Name Prefix', group: 'Identity', generate: () => faker().person.prefix() },
  { id: 'suffix', label: 'Name Suffix', group: 'Identity', generate: () => faker().person.suffix() },
  { id: 'username', label: 'Username', group: 'Identity', generate: () => faker().internet.username() },
  { id: 'displayName', label: 'Display Name', group: 'Identity', generate: () => faker().internet.displayName() },
  { id: 'email', label: 'Email', group: 'Identity', generate: () => faker().internet.email() },
  { id: 'phone', label: 'Phone', group: 'Identity', generate: () => faker().phone.number() },
  { id: 'sex', label: 'Sex', group: 'Identity', generate: () => faker().person.sex() },
  { id: 'gender', label: 'Gender', group: 'Identity', generate: () => faker().person.gender() },
  { id: 'bio', label: 'Bio', group: 'Identity', generate: () => faker().person.bio() },
  { id: 'zodiac', label: 'Zodiac Sign', group: 'Identity', generate: () => faker().person.zodiacSign() },
  { id: 'jobTitle', label: 'Job Title', group: 'Identity', generate: () => faker().person.jobTitle() },
  { id: 'jobType', label: 'Job Type', group: 'Identity', generate: () => faker().person.jobType() },
  { id: 'jobArea', label: 'Job Area', group: 'Identity', generate: () => faker().person.jobArea() },

  // Numbers
  { id: 'number', label: 'Number', group: 'Numbers', generate: () => faker().number.int({ min: 0, max: 1000 }).toString() },
  { id: 'float', label: 'Float', group: 'Numbers', generate: () => faker().number.float({ min: 0, max: 1000, fractionDigits: 2 }).toFixed(2) },
  { id: 'boolean', label: 'Boolean', group: 'Numbers', generate: () => faker().datatype.boolean().toString() },
  { id: 'hexNumber', label: 'Hex Number', group: 'Numbers', generate: () => faker().number.hex({ max: 0xffffff }) },
  { id: 'binary', label: 'Binary Number', group: 'Numbers', generate: () => faker().number.binary({ max: 255 }) },
  { id: 'octal', label: 'Octal Number', group: 'Numbers', generate: () => faker().number.octal({ max: 511 }) },

  // Text — `string` is alphanumeric (symbol-free, so it survives quote-wrapping); `lorem` is randomized.
  { id: 'string', label: 'String', group: 'Text', generate: () => faker().string.alphanumeric(15) },
  { id: 'alpha', label: 'Alpha String', group: 'Text', generate: () => faker().string.alpha(10) },
  { id: 'numeric', label: 'Numeric String', group: 'Text', generate: () => faker().string.numeric(10) },
  { id: 'word', label: 'Word', group: 'Text', generate: () => faker().lorem.word() },
  { id: 'words', label: 'Words', group: 'Text', generate: () => faker().lorem.words({ min: 3, max: 6 }) },
  { id: 'sentence', label: 'Sentence', group: 'Text', generate: () => faker().lorem.sentence() },
  { id: 'slug', label: 'Slug', group: 'Text', generate: () => faker().lorem.slug() },
  { id: 'lorem', label: 'Lorem Paragraph', group: 'Text', generate: () => faker().lorem.paragraph() },
  { id: 'hackerPhrase', label: 'Hacker Phrase', group: 'Text', generate: () => faker().hacker.phrase() },
  { id: 'emoji', label: 'Emoji', group: 'Text', generate: () => faker().internet.emoji() },
  { id: 'bookTitle', label: 'Book Title', group: 'Text', generate: () => faker().book.title() },
  { id: 'bookAuthor', label: 'Book Author', group: 'Text', generate: () => faker().book.author() },

  // Time
  { id: 'date', label: 'Date', group: 'Time', generate: () => faker().date.anytime().toISOString() },
  { id: 'pastDate', label: 'Past Date', group: 'Time', generate: () => faker().date.past().toISOString() },
  { id: 'futureDate', label: 'Future Date', group: 'Time', generate: () => faker().date.future().toISOString() },
  { id: 'recentDate', label: 'Recent Date', group: 'Time', generate: () => faker().date.recent().toISOString() },
  { id: 'soonDate', label: 'Soon Date', group: 'Time', generate: () => faker().date.soon().toISOString() },
  { id: 'birthdate', label: 'Birthdate', group: 'Time', generate: () => faker().date.birthdate().toISOString() },
  { id: 'weekday', label: 'Weekday', group: 'Time', generate: () => faker().date.weekday() },
  { id: 'month', label: 'Month', group: 'Time', generate: () => faker().date.month() },

  // Location
  { id: 'country', label: 'Country', group: 'Location', generate: () => faker().location.country() },
  { id: 'countryCode', label: 'Country Code', group: 'Location', generate: () => faker().location.countryCode() },
  { id: 'state', label: 'State', group: 'Location', generate: () => faker().location.state() },
  { id: 'stateAbbr', label: 'State Abbreviation', group: 'Location', generate: () => faker().location.state({ abbreviated: true }) },
  { id: 'county', label: 'County', group: 'Location', generate: () => faker().location.county() },
  { id: 'city', label: 'City', group: 'Location', generate: () => faker().location.city() },
  { id: 'zipCode', label: 'Zip Code', group: 'Location', generate: () => faker().location.zipCode() },
  { id: 'street', label: 'Street Name', group: 'Location', generate: () => faker().location.street() },
  { id: 'address', label: 'Street Address', group: 'Location', generate: () => faker().location.streetAddress() },
  { id: 'secondaryAddress', label: 'Secondary Address', group: 'Location', generate: () => faker().location.secondaryAddress() },
  { id: 'buildingNumber', label: 'Building Number', group: 'Location', generate: () => faker().location.buildingNumber() },
  { id: 'direction', label: 'Direction', group: 'Location', generate: () => faker().location.direction() },
  { id: 'latitude', label: 'Latitude', group: 'Location', generate: () => faker().location.latitude().toString() },
  { id: 'longitude', label: 'Longitude', group: 'Location', generate: () => faker().location.longitude().toString() },
  { id: 'timeZone', label: 'Time Zone', group: 'Location', generate: () => faker().location.timeZone() },

  // Network
  { id: 'ipv4', label: 'IP Address', group: 'Network', generate: () => faker().internet.ipv4() },
  { id: 'ipv6', label: 'IPv6 Address', group: 'Network', generate: () => faker().internet.ipv6() },
  { id: 'mac', label: 'MAC Address', group: 'Network', generate: () => faker().internet.mac() },
  { id: 'url', label: 'URL', group: 'Network', generate: () => faker().internet.url() },
  { id: 'domainName', label: 'Domain Name', group: 'Network', generate: () => faker().internet.domainName() },
  { id: 'port', label: 'Port', group: 'Network', generate: () => faker().internet.port().toString() },
  { id: 'protocol', label: 'Protocol', group: 'Network', generate: () => faker().internet.protocol() },
  { id: 'httpMethod', label: 'HTTP Method', group: 'Network', generate: () => faker().internet.httpMethod() },
  { id: 'httpStatus', label: 'HTTP Status Code', group: 'Network', generate: () => faker().internet.httpStatusCode().toString() },
  { id: 'userAgent', label: 'User Agent', group: 'Network', generate: () => faker().internet.userAgent() },
  { id: 'jwt', label: 'JWT', group: 'Network', generate: () => faker().internet.jwt() },

  // Design
  { id: 'color', label: 'Color (hex)', group: 'Design', generate: () => faker().color.rgb({ format: 'hex' }) },
  { id: 'rgb', label: 'Color (rgb)', group: 'Design', generate: () => faker().color.rgb({ format: 'css' }) },
  { id: 'hsl', label: 'Color (hsl)', group: 'Design', generate: () => faker().color.hsl({ format: 'css' }) },
  { id: 'colorName', label: 'Color Name', group: 'Design', generate: () => faker().color.human() },

  // Security
  { id: 'password', label: 'Password', group: 'Security', generate: () => faker().internet.password() },

  // IDs
  { id: 'uuid', label: 'UUID', group: 'IDs', generate: () => faker().string.uuid() },
  { id: 'ulid', label: 'ULID', group: 'IDs', generate: () => faker().string.ulid() },
  { id: 'nanoid', label: 'Nano ID', group: 'IDs', generate: () => faker().string.nanoid() },
  { id: 'hash', label: 'Hash', group: 'IDs', generate: () => faker().string.hexadecimal({ length: 13, casing: 'lower', prefix: '' }) },

  // Nature
  { id: 'animal', label: 'Animal', group: 'Nature', generate: () => faker().animal.type() },
  { id: 'dog', label: 'Dog Breed', group: 'Nature', generate: () => faker().animal.dog() },
  { id: 'cat', label: 'Cat Breed', group: 'Nature', generate: () => faker().animal.cat() },
  { id: 'bird', label: 'Bird Species', group: 'Nature', generate: () => faker().animal.bird() },
  { id: 'fish', label: 'Fish Species', group: 'Nature', generate: () => faker().animal.fish() },
  { id: 'horse', label: 'Horse Breed', group: 'Nature', generate: () => faker().animal.horse() },

  // Company
  { id: 'company', label: 'Company Name', group: 'Company', generate: () => faker().company.name() },
  { id: 'catchPhrase', label: 'Catch Phrase', group: 'Company', generate: () => faker().company.catchPhrase() },
  { id: 'buzzPhrase', label: 'Buzz Phrase', group: 'Company', generate: () => faker().company.buzzPhrase() },

  // Commerce
  { id: 'product', label: 'Product', group: 'Commerce', generate: () => faker().commerce.product() },
  { id: 'productName', label: 'Product Name', group: 'Commerce', generate: () => faker().commerce.productName() },
  { id: 'price', label: 'Price', group: 'Commerce', generate: () => faker().commerce.price() },
  { id: 'department', label: 'Department', group: 'Commerce', generate: () => faker().commerce.department() },
  { id: 'productMaterial', label: 'Product Material', group: 'Commerce', generate: () => faker().commerce.productMaterial() },
  { id: 'productDescription', label: 'Product Description', group: 'Commerce', generate: () => faker().commerce.productDescription() },
  { id: 'isbn', label: 'ISBN', group: 'Commerce', generate: () => faker().commerce.isbn() },

  // Finance
  { id: 'amount', label: 'Amount', group: 'Finance', generate: () => faker().finance.amount() },
  { id: 'currencyCode', label: 'Currency Code', group: 'Finance', generate: () => faker().finance.currencyCode() },
  { id: 'currencyName', label: 'Currency Name', group: 'Finance', generate: () => faker().finance.currencyName() },
  { id: 'currencySymbol', label: 'Currency Symbol', group: 'Finance', generate: () => faker().finance.currencySymbol() },
  { id: 'creditCard', label: 'Credit Card Number', group: 'Finance', generate: () => faker().finance.creditCardNumber() },
  { id: 'creditCardCVV', label: 'Credit Card CVV', group: 'Finance', generate: () => faker().finance.creditCardCVV() },
  { id: 'iban', label: 'IBAN', group: 'Finance', generate: () => faker().finance.iban() },
  { id: 'bic', label: 'BIC', group: 'Finance', generate: () => faker().finance.bic() },
  { id: 'accountNumber', label: 'Account Number', group: 'Finance', generate: () => faker().finance.accountNumber() },
  { id: 'routingNumber', label: 'Routing Number', group: 'Finance', generate: () => faker().finance.routingNumber() },
  { id: 'bitcoin', label: 'Bitcoin Address', group: 'Finance', generate: () => faker().finance.bitcoinAddress() },
  { id: 'ethereum', label: 'Ethereum Address', group: 'Finance', generate: () => faker().finance.ethereumAddress() },
  { id: 'pin', label: 'PIN', group: 'Finance', generate: () => faker().finance.pin() },

  // Git
  { id: 'gitBranch', label: 'Git Branch', group: 'Git', generate: () => faker().git.branch() },
  { id: 'gitCommitSha', label: 'Git Commit SHA', group: 'Git', generate: () => faker().git.commitSha() },
  { id: 'gitCommitMessage', label: 'Git Commit Message', group: 'Git', generate: () => faker().git.commitMessage() },

  // System
  { id: 'fileName', label: 'File Name', group: 'System', generate: () => faker().system.fileName() },
  { id: 'filePath', label: 'File Path', group: 'System', generate: () => faker().system.filePath() },
  { id: 'fileExt', label: 'File Extension', group: 'System', generate: () => faker().system.fileExt() },
  { id: 'mimeType', label: 'MIME Type', group: 'System', generate: () => faker().system.mimeType() },
  { id: 'semver', label: 'Semver', group: 'System', generate: () => faker().system.semver() },
  { id: 'cron', label: 'Cron Expression', group: 'System', generate: () => faker().system.cron() },

  // Vehicle
  { id: 'vehicle', label: 'Vehicle', group: 'Vehicle', generate: () => faker().vehicle.vehicle() },
  { id: 'vehicleManufacturer', label: 'Vehicle Manufacturer', group: 'Vehicle', generate: () => faker().vehicle.manufacturer() },
  { id: 'vehicleModel', label: 'Vehicle Model', group: 'Vehicle', generate: () => faker().vehicle.model() },
  { id: 'vin', label: 'VIN', group: 'Vehicle', generate: () => faker().vehicle.vin() },
  { id: 'vrm', label: 'License Plate (VRM)', group: 'Vehicle', generate: () => faker().vehicle.vrm() },

  // Food
  { id: 'dish', label: 'Dish', group: 'Food', generate: () => faker().food.dish() },
  { id: 'ingredient', label: 'Ingredient', group: 'Food', generate: () => faker().food.ingredient() },
  { id: 'fruit', label: 'Fruit', group: 'Food', generate: () => faker().food.fruit() },
  { id: 'vegetable', label: 'Vegetable', group: 'Food', generate: () => faker().food.vegetable() },
  { id: 'cuisine', label: 'Cuisine', group: 'Food', generate: () => faker().food.ethnicCategory() },

  // Music
  { id: 'songName', label: 'Song Name', group: 'Music', generate: () => faker().music.songName() },
  { id: 'musicGenre', label: 'Music Genre', group: 'Music', generate: () => faker().music.genre() },
  { id: 'artist', label: 'Artist', group: 'Music', generate: () => faker().music.artist() },
  { id: 'album', label: 'Album', group: 'Music', generate: () => faker().music.album() },

  // Travel
  { id: 'airline', label: 'Airline', group: 'Travel', generate: () => faker().airline.airline().name },
  { id: 'airport', label: 'Airport', group: 'Travel', generate: () => faker().airline.airport().name },
  { id: 'flightNumber', label: 'Flight Number', group: 'Travel', generate: () => faker().airline.flightNumber({ addLeadingZeros: true }) },
  { id: 'seat', label: 'Seat', group: 'Travel', generate: () => faker().airline.seat() },

  // Back-compat sized variants — drive the legacy Lorem/Hash Small/Medium/Large commands only.
  { id: 'loremSmall', label: 'Lorem (small)', group: 'Text', hidden: true, generate: () => faker().lorem.sentence() },
  { id: 'loremMedium', label: 'Lorem (medium)', group: 'Text', hidden: true, generate: () => faker().lorem.paragraph() },
  { id: 'loremLarge', label: 'Lorem (large)', group: 'Text', hidden: true, generate: () => faker().lorem.paragraphs(3) },
  { id: 'hashSmall', label: 'Hash (7)', group: 'IDs', hidden: true, generate: () => faker().string.hexadecimal({ length: 7, casing: 'lower', prefix: '' }) },
  { id: 'hashMedium', label: 'Hash (17)', group: 'IDs', hidden: true, generate: () => faker().string.hexadecimal({ length: 17, casing: 'lower', prefix: '' }) },
  { id: 'hashLarge', label: 'Hash (27)', group: 'IDs', hidden: true, generate: () => faker().string.hexadecimal({ length: 27, casing: 'lower', prefix: '' }) },
];

const byId = new Map<string, Generator>(generators.map((generator) => [ generator.id, generator ]));

/** Look up a generator by id, or `undefined` if none matches. */
export function getGenerator(id: string): Generator | undefined {
  return byId.get(id);
}
