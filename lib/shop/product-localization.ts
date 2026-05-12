import {
  autoTranslateList,
  autoTranslateText,
  sanitizeLocalizedText,
} from "@/lib/shop/auto-localization";
import type {
  Locale,
  ProductLocaleContent,
  ProductTranslationMap,
  StorefrontProduct,
  StorefrontProductVariant,
} from "@/lib/shop/types";

type AutoLocalizedProductContent = ProductLocaleContent & {
  colors?: string[];
  variants?: Array<Partial<Pick<StorefrontProductVariant, "name" | "details" | "color">>>;
};

const SEARCH_LOCALES: Locale[] = ["es", "nl", "en", "pt"];

const AUTO_PRODUCT_TRANSLATIONS: Record<
  string,
  Partial<Record<Locale, AutoLocalizedProductContent>>
> = {
  "PRD-001": {
    en: {
      name: "Home Appliances Product",
      shortDescription:
        "Home appliances product with an ecommerce-ready presentation and a direct-sales focus.",
      longDescription:
        "Home appliances product prepared for a digital catalog, focused on visual trust, fast reading, and a clear sales sheet. The listing keeps the original brand and organizes the announcement to highlight benefits, category, and the product's presence in the store.",
      category: "Home Appliances",
      tags: ["home appliances", "zorvya", "product", "premium", "ecommerce"],
      inventoryLabel: "Local warehouse",
      deliveryLabel: "Free delivery",
      badge: "Product",
    },
    nl: {
      name: "Product voor huishoudelijke apparaten",
      shortDescription:
        "Product voor huishoudelijke apparaten met een geoptimaliseerde e-commerce presentatie en focus op directe verkoop.",
      longDescription:
        "Product voor huishoudelijke apparaten voorbereid voor een digitale catalogus, met focus op visueel vertrouwen, snelle leesbaarheid en een duidelijke verkooppresentatie. De advertentie behoudt het originele merk en ordent de voordelen, categorie en aanwezigheid van het product in de winkel.",
      category: "Huishoudelijke apparaten",
      tags: ["huishoudelijke apparaten", "zorvya", "product", "premium", "e-commerce"],
      inventoryLabel: "Lokale voorraad",
      deliveryLabel: "Gratis levering",
      badge: "Product",
    },
    pt: {
      name: "Produto de eletrodomesticos",
      shortDescription:
        "Produto de eletrodomesticos com apresentacao otimizada para ecommerce e foco em venda direta.",
      longDescription:
        "Produto de eletrodomesticos preparado para catalogo digital, com foco em confianca visual, leitura rapida e ficha comercial clara. O anuncio preserva a marca original e organiza os beneficios, a categoria e a presenca do produto na loja.",
      category: "Eletrodomesticos",
      tags: ["eletrodomesticos", "zorvya", "produto", "premium", "ecommerce"],
      inventoryLabel: "Armazem local",
      deliveryLabel: "Entrega gratis",
      badge: "Produto",
    },
  },
  "ELEC-NIPPON-1": {
    es: {
      name: "Nippon arrocera digital multifuncion 12 en 1 (1.8 L / 2.8 L) - Cocina inteligente",
      shortDescription:
        "La arrocera digital multifuncion Nippon 12 en 1 esta pensada para que cocinar todos los dias sea mas facil y eficiente. Con varios modos de coccion puedes preparar arroz, sopas, guisos, granos y platos al vapor con un solo toque.",
      longDescription:
        "La arrocera digital multifuncion Nippon 12 en 1 esta pensada para que cocinar todos los dias sea mas facil y eficiente. Con varios modos de coccion puedes preparar arroz blanco, arroz integral, sopas, guisos, granos y platos al vapor con un solo toque.\n\nSu panel digital intuitivo permite controlar la coccion con precision e incluye funciones utiles como temporizador diferido y mantener caliente, para que la comida este lista exactamente cuando la necesitas.\n\nSu diseno moderno, resistente y compacto la convierte en una excelente opcion para cualquier cocina.",
      category: "Electrodomesticos",
      tags: ["arrocera", "cocina inteligente", "nippon", "multifuncion", "cocina diaria"],
      inventoryLabel: "Almacen local",
      deliveryLabel: "Delivery gratis",
    },
    nl: {
      name: "Nippon 12-in-1 digitale multifunctionele rijstkoker (1.8 L / 2.8 L) - Slim koken",
      shortDescription:
        "De Nippon 12-in-1 multifunctionele rijstkoker maakt dagelijks koken eenvoudiger en efficienter. Met meerdere kookstanden bereid je rijst, soepen, stoofgerechten, granen en gestoomde gerechten met een druk op de knop.",
      longDescription:
        "De Nippon 12-in-1 multifunctionele rijstkoker maakt dagelijks koken eenvoudiger en efficienter. Met meerdere kookstanden bereid je witte rijst, bruine rijst, soepen, stoofgerechten, granen en gestoomde gerechten met een druk op de knop.\n\nHet intuItieve digitale bedieningspaneel geeft je nauwkeurige controle over het kookproces en bevat handige functies zoals een uitgestelde timer en warmhoudfunctie, zodat je maaltijd precies op tijd klaarstaat.\n\nHet moderne, stevige en compacte ontwerp maakt dit toestel een uitstekende aanvulling op elke keuken.",
      category: "Huishoudelijke apparaten",
      tags: ["rijstkoker", "slim koken", "nippon", "multifunctioneel", "dagelijks koken"],
      inventoryLabel: "Lokale voorraad",
      deliveryLabel: "Gratis levering",
    },
    pt: {
      name: "Panela de arroz digital multifuncional Nippon 12 em 1 (1.8 L / 2.8 L) - Cozinha inteligente",
      shortDescription:
        "A panela de arroz digital multifuncional Nippon 12 em 1 foi criada para deixar o preparo diario mais facil e eficiente. Com varios modos de cozimento, voce prepara arroz, sopas, ensopados, graos e pratos no vapor com um toque.",
      longDescription:
        "A panela de arroz digital multifuncional Nippon 12 em 1 foi criada para deixar o preparo diario mais facil e eficiente. Com varios modos de cozimento, voce prepara arroz branco, arroz integral, sopas, ensopados, graos e pratos no vapor com um toque.\n\nO painel digital intuitivo permite controlar o cozimento com precisao e inclui recursos uteis como timer programavel e funcao manter aquecido, para que a refeicao fique pronta exatamente quando voce precisar.\n\nSeu design moderno, resistente e compacto faz dela uma excelente escolha para qualquer cozinha.",
      category: "Eletrodomesticos",
      tags: ["panela de arroz", "cozinha inteligente", "nippon", "multifuncional", "cozinha diaria"],
      inventoryLabel: "Armazem local",
      deliveryLabel: "Entrega gratis",
    },
  },
  "CATA-ARTICULO": {
    en: {
      name: "Featured item",
      shortDescription:
        "Featured item in the General Catalog category, prepared for online sales with a clear commercial description, a clean visual approach, and fast reading for the customer.",
      longDescription:
        "Featured item in the General Catalog category, prepared for online sales with a clear commercial description, a clean visual approach, and fast reading for the customer.",
      category: "General Catalog",
      tags: ["featured", "item", "catalog", "general", "product", "store"],
      variants: [{ name: "Pot" }],
      badge: "Featured",
    },
    nl: {
      name: "Uitgelicht artikel",
      shortDescription:
        "Uitgelicht artikel in de categorie Algemene catalogus, gepresenteerd voor online verkoop met een duidelijke commerciële beschrijving, een nette visuele stijl en snelle leesbaarheid voor de klant.",
      longDescription:
        "Uitgelicht artikel in de categorie Algemene catalogus, gepresenteerd voor online verkoop met een duidelijke commerciële beschrijving, een nette visuele stijl en snelle leesbaarheid voor de klant.",
      category: "Algemene catalogus",
      tags: ["uitgelicht", "artikel", "catalogus", "algemeen", "product", "winkel"],
      variants: [{ name: "Pan" }],
      badge: "Uitgelicht",
    },
    pt: {
      name: "Artigo em destaque",
      shortDescription:
        "Artigo em destaque na categoria Catalogo geral, apresentado para venda online com descricao comercial clara, visual limpo e leitura rapida para o cliente.",
      longDescription:
        "Artigo em destaque na categoria Catalogo geral, apresentado para venda online com descricao comercial clara, visual limpo e leitura rapida para o cliente.",
      category: "Catalogo geral",
      tags: ["artigo", "destaque", "catalogo", "geral", "produto", "loja"],
      variants: [{ name: "Panela" }],
      badge: "Destaque",
    },
  },
  "OFFI-ERGONOMI": {
    es: {
      name: "Silla de oficina ergonomica con reposacabezas",
      shortDescription:
        "Esta silla de oficina ergonomica ofrece maxima comodidad durante largas jornadas. Incluye respaldo de malla transpirable, reposacabezas ajustable y asiento acolchado para mejorar la postura y el soporte diario.",
      longDescription:
        "Esta silla de oficina ergonomica ofrece maxima comodidad durante largas jornadas. Incluye respaldo de malla transpirable, reposacabezas ajustable y asiento acolchado para brindar mejor soporte a la espalda y a la postura.\n\nSu diseno moderno, ruedas suaves y base resistente la hacen ideal para oficinas en casa, setups gamer o espacios de trabajo profesionales.\n\nModelo: JG-656",
      category: "Muebles de oficina / Mobiliario -> Sillas de oficina",
    },
    nl: {
      name: "Ergonomische bureaustoel met hoofdsteun",
      shortDescription:
        "Deze ergonomische bureaustoel is ontworpen voor maximaal comfort tijdens lange werkdagen. Met een ademende mesh-rug, verstelbare hoofdsteun en gevoerde zitting ondersteunt hij je houding de hele dag door.",
      longDescription:
        "Deze ergonomische bureaustoel is ontworpen voor maximaal comfort tijdens lange werkdagen. Met een ademende mesh-rug, verstelbare hoofdsteun en gevoerde zitting biedt hij uitstekende ondersteuning voor je rug en houding.\n\nHet moderne ontwerp, de soepel rollende wielen en de stevige basis maken hem perfect voor thuiswerkplekken, gaming-opstellingen of professionele kantoren.\n\nModel: JG-656",
      category: "Kantoormeubilair / Meubels -> Bureaustoelen",
    },
    pt: {
      name: "Cadeira ergonomica de escritorio com apoio de cabeca",
      shortDescription:
        "Esta cadeira ergonomica de escritorio foi criada para oferecer conforto maximo durante longas horas de trabalho. Com encosto em malha respiravel, apoio de cabeca ajustavel e assento acolchoado, ela melhora o suporte e a postura no dia a dia.",
      longDescription:
        "Esta cadeira ergonomica de escritorio foi criada para oferecer conforto maximo durante longas horas de trabalho. Com encosto em malha respiravel, apoio de cabeca ajustavel e assento acolchoado, ela oferece excelente suporte para as costas e para a postura.\n\nO design moderno, as rodas suaves e a base resistente tornam esta cadeira ideal para home office, setups gamer ou ambientes profissionais.\n\nModelo: JG-656",
      category: "Moveis de escritorio / Mobilia -> Cadeiras de escritorio",
    },
  },
  "CATA-BLENDER-": {
    es: {
      name: "Licuadora Lotus 2 en 1 con jarra plastica",
      shortDescription:
        "La licuadora Lotus 2 en 1 es un electrodomestico practico y versatil para el uso diario. Con su jarra plastica de 1.6 L y el vaso triturador adicional, permite preparar batidos, jugos, salsas y moler ingredientes con facilidad.",
      longDescription:
        "La licuadora Lotus 2 en 1 es un electrodomestico practico y versatil para el uso diario. Con su jarra plastica de 1.6 L y el vaso triturador adicional, permite preparar batidos, jugos, salsas y moler ingredientes con facilidad. Su motor potente y su control simple la hacen ideal para mezclas rapidas y eficientes en cualquier cocina.\n\nESPECIFICACIONES\nModelo: LT-9857\nCapacidad: 1.6 litros\nMaterial: Jarra plastica + base resistente\nFunciones: Licuar / Moler\nVoltaje: 110V",
      category: "Catalogo General",
      tags: ["articulo", "destacado", "catalogo", "general", "producto", "tienda"],
    },
    en: {
      name: "Lotus 2-in-1 blender with plastic jar",
      shortDescription:
        "The Lotus 2-in-1 blender is a practical everyday kitchen appliance. With a 1.6 L plastic jar and an extra grinder cup, it helps you prepare smoothies, juices, sauces, and ground ingredients with ease.",
      longDescription:
        "The Lotus 2-in-1 blender is a practical everyday kitchen appliance. With a 1.6 L plastic jar and an extra grinder cup, it helps you prepare smoothies, juices, sauces, and ground ingredients with ease. Its powerful motor and simple controls make it perfect for fast, efficient blending in any kitchen.\n\nSPECIFICATIONS\nModel: LT-9857\nCapacity: 1.6 liters\nMaterial: Plastic jar + durable base\nFunctions: Blend / Grind\nVoltage: 110V",
      category: "General Catalog",
      tags: ["featured", "item", "catalog", "general", "product", "store"],
    },
    nl: {
      name: "Lotus 2-in-1 blender met plastic kan",
      shortDescription:
        "De Lotus 2-in-1 blender is een praktische en veelzijdige keukenhulp voor dagelijks gebruik. Met een plastic kan van 1.6 L en een extra maalbeker maak je eenvoudig smoothies, sappen, sauzen en gemalen ingredienten.",
      longDescription:
        "De Lotus 2-in-1 blender is een praktische en veelzijdige keukenhulp voor dagelijks gebruik. Met een plastic kan van 1.6 L en een extra maalbeker maak je eenvoudig smoothies, sappen, sauzen en gemalen ingredienten. De krachtige motor en eenvoudige bediening zorgen voor snel en efficient mixen in elke keuken.\n\nSPECIFICATIES\nModel: LT-9857\nInhoud: 1.6 liter\nMateriaal: Plastic kan + stevige basis\nFuncties: Mixen / Malen\nSpanning: 110V",
      category: "Algemene catalogus",
      tags: ["uitgelicht", "artikel", "catalogus", "algemeen", "product", "winkel"],
    },
    pt: {
      name: "Liquidificador Lotus 2 em 1 com jarra plastica",
      shortDescription:
        "O liquidificador Lotus 2 em 1 e um eletrodomestico pratico e versatil para o uso diario. Com jarra plastica de 1.6 L e copo moedor adicional, ele facilita o preparo de vitaminas, sucos, molhos e ingredientes moidos.",
      longDescription:
        "O liquidificador Lotus 2 em 1 e um eletrodomestico pratico e versatil para o uso diario. Com jarra plastica de 1.6 L e copo moedor adicional, ele facilita o preparo de vitaminas, sucos, molhos e ingredientes moidos. O motor potente e o controle simples tornam o uso rapido e eficiente em qualquer cozinha.\n\nESPECIFICACOES\nModelo: LT-9857\nCapacidade: 1.6 litros\nMaterial: Jarra plastica + base resistente\nFuncoes: Liquidificar / Moer\nVoltagem: 110V",
      category: "Catalogo geral",
      tags: ["artigo", "destaque", "catalogo", "geral", "produto", "loja"],
    },
  },
  "HOME-BLENDER-": {
    es: {
      name: "Licuadora Lotus 2 en 1 con jarra plastica",
      shortDescription:
        "La licuadora Lotus 2 en 1 modelo LT-9877 combina rendimiento y estilo con un moderno diseno rojo. Incluye una jarra plastica de 1.6 L y un accesorio triturador adicional, ideal para preparar batidos, jugos, salsas y moler ingredientes.",
      longDescription:
        "La licuadora Lotus 2 en 1 modelo LT-9877 combina rendimiento y estilo con un moderno diseno rojo. Incluye una jarra plastica de 1.6 L y un accesorio triturador adicional, ideal para preparar batidos, jugos, salsas y moler ingredientes. Su motor potente y la perilla de control simple garantizan mezclas rapidas y eficientes para el uso diario.\n\nESPECIFICACIONES\nModelo: LT-9877\nCapacidad: 1.6 litros\nMaterial: Jarra plastica + base resistente\nFunciones: Licuar / Moler\nVoltaje: 110V",
      category: "Electrodomesticos -> Electrodomesticos de cocina -> Licuadoras",
    },
    nl: {
      name: "Lotus 2-in-1 blender met plastic kan",
      shortDescription:
        "De Lotus 2-in-1 blender, model LT-9877, combineert prestaties en stijl met een modern rood ontwerp. Hij heeft een plastic kan van 1.6 L en een extra maalaccessoire voor smoothies, sappen, sauzen en gemalen ingredienten.",
      longDescription:
        "De Lotus 2-in-1 blender, model LT-9877, combineert prestaties en stijl met een modern rood ontwerp. Hij heeft een plastic kan van 1.6 L en een extra maalaccessoire, waardoor hij perfect is voor smoothies, sappen, sauzen en gemalen ingredienten. De krachtige motor en eenvoudige draaiknop zorgen voor snel en efficient dagelijks gebruik.\n\nSPECIFICATIES\nModel: LT-9877\nInhoud: 1.6 liter\nMateriaal: Plastic kan + stevige basis\nFuncties: Mixen / Malen\nSpanning: 110V",
      category: "Huishoudelijke apparaten -> Keukenapparaten -> Blenders",
    },
    pt: {
      name: "Liquidificador Lotus 2 em 1 com jarra plastica",
      shortDescription:
        "O liquidificador Lotus 2 em 1 modelo LT-9877 combina desempenho e estilo com um design vermelho moderno. Ele traz uma jarra plastica de 1.6 L e um acessorio moedor adicional, perfeito para vitaminas, sucos, molhos e ingredientes moidos.",
      longDescription:
        "O liquidificador Lotus 2 em 1 modelo LT-9877 combina desempenho e estilo com um design vermelho moderno. Ele traz uma jarra plastica de 1.6 L e um acessorio moedor adicional, perfeito para vitaminas, sucos, molhos e ingredientes moidos. O motor potente e o seletor simples garantem preparo rapido e eficiente para o uso diario.\n\nESPECIFICACOES\nModelo: LT-9877\nCapacidade: 1.6 litros\nMaterial: Jarra plastica + base resistente\nFuncoes: Liquidificar / Moer\nVoltagem: 110V",
      category: "Eletrodomesticos -> Aparelhos de cozinha -> Liquidificadores",
    },
  },
  "HOME-OASIS-DO": {
    es: {
      name: "Hornilla electrica doble Oasis de 2 platos - Modelo OA-9002",
      shortDescription:
        "La hornilla electrica doble Oasis es una solucion practica y eficiente para cocinar en cualquier lugar. Sus dos placas de calentamiento permiten preparar varios platos al mismo tiempo, ideal para cocinas pequenas, dormitorios o exteriores.",
      longDescription:
        "La hornilla electrica doble Oasis es una solucion practica y eficiente para cocinar en cualquier lugar. Sus dos placas de calentamiento permiten preparar varios platos al mismo tiempo, ideal para cocinas pequenas, dormitorios o exteriores. Su diseno compacto, los controles de temperatura ajustables y la superficie resistente hacen que sea facil de usar todos los dias.\n\nESPECIFICACIONES\nModelo: OA-9002\nTipo: Hornilla electrica\nPlatos: 2\nVoltaje: 110V\nMaterial: Metal + resistencias",
      category: "Electrodomesticos -> Electrodomesticos de cocina -> Hornillas electricas",
    },
    nl: {
      name: "Oasis dubbele elektrische kookplaat met 2 platen - Model OA-9002",
      shortDescription:
        "De dubbele elektrische kookplaat van Oasis is een praktische en efficiente oplossing om overal te koken. Met twee verwarmingsplaten bereid je meerdere gerechten tegelijk, ideaal voor kleine keukens, studentenkamers of buitengebruik.",
      longDescription:
        "De dubbele elektrische kookplaat van Oasis is een praktische en efficiente oplossing om overal te koken. Met twee verwarmingsplaten bereid je meerdere gerechten tegelijk, ideaal voor kleine keukens, studentenkamers of buitengebruik. Het compacte ontwerp, de verstelbare temperatuurregelaars en het duurzame oppervlak maken dagelijks gebruik eenvoudig.\n\nSPECIFICATIES\nModel: OA-9002\nType: Elektrische kookplaat\nPlaten: 2\nSpanning: 110V\nMateriaal: Metaal + verwarmingsspiralen",
      category: "Huishoudelijke apparaten -> Keukenapparaten -> Elektrische kookplaten",
    },
    pt: {
      name: "Fogareiro eletrico duplo Oasis com 2 bocas - Modelo OA-9002",
      shortDescription:
        "O fogareiro eletrico duplo Oasis e uma solucao pratica e eficiente para cozinhar em qualquer lugar. Com duas chapas de aquecimento, permite preparar varios pratos ao mesmo tempo, ideal para cozinhas pequenas, dormitorios ou areas externas.",
      longDescription:
        "O fogareiro eletrico duplo Oasis e uma solucao pratica e eficiente para cozinhar em qualquer lugar. Com duas chapas de aquecimento, permite preparar varios pratos ao mesmo tempo, ideal para cozinhas pequenas, dormitorios ou areas externas. O design compacto, os controles de temperatura ajustaveis e a superficie resistente facilitam o uso diario.\n\nESPECIFICACOES\nModelo: OA-9002\nTipo: Fogareiro eletrico\nBocas: 2\nVoltagem: 110V\nMaterial: Metal + resistencias",
      category: "Eletrodomesticos -> Aparelhos de cozinha -> Fogareiros eletricos",
    },
  },
  "ELEC-HISENSE-": {
    es: {
      name: "Hisense Smart TV Roku Full HD de 43 pulgadas - Modelo 43H4080F",
      shortDescription:
        "La Hisense Roku TV Full HD de 43 pulgadas ofrece una experiencia de entretenimiento completa con imagen nitida y funciones inteligentes. Disfruta Netflix, YouTube y muchas otras aplicaciones gracias al sistema Roku integrado.",
      longDescription:
        "La Hisense Roku TV Full HD de 43 pulgadas ofrece una experiencia de entretenimiento completa con imagen nitida y funciones inteligentes. Disfruta Netflix, YouTube y muchas otras aplicaciones gracias al sistema Roku integrado. Su diseno elegante y la pantalla vibrante la convierten en una excelente opcion para sala, dormitorio u oficina.\n\nESPECIFICACIONES\nModelo: 43H4080F\nTamano: 43 pulgadas\nResolucion: Full HD (1080p)\nSistema inteligente: Roku TV\nConectividad: HDMI / USB / WiFi",
      category: "Electronica -> TV y entretenimiento en casa -> Smart TVs",
    },
    nl: {
      name: "Hisense 43 inch Full HD Roku Smart TV - Model 43H4080F",
      shortDescription:
        "De Hisense 43 inch Full HD Roku TV levert een complete entertainmentervaring met scherp beeld en slimme functies. Geniet van Netflix, YouTube en meer met het ingebouwde Roku-systeem.",
      longDescription:
        "De Hisense 43 inch Full HD Roku TV levert een complete entertainmentervaring met scherp beeld en slimme functies. Geniet van Netflix, YouTube en meer met het ingebouwde Roku-systeem. Het slanke ontwerp en het levendige scherm maken deze tv perfect voor woonkamer, slaapkamer of kantoor.\n\nSPECIFICATIES\nModel: 43H4080F\nFormaat: 43 inch\nResolutie: Full HD (1080p)\nSmart-systeem: Roku TV\nConnectiviteit: HDMI / USB / WiFi",
      category: "Elektronica -> TV en home entertainment -> Smart-tv's",
    },
    pt: {
      name: "Hisense Smart TV Roku Full HD de 43 polegadas - Modelo 43H4080F",
      shortDescription:
        "A Hisense Roku TV Full HD de 43 polegadas oferece uma experiencia completa de entretenimento com imagem nitida e recursos inteligentes. Aproveite Netflix, YouTube e outros aplicativos com o sistema Roku integrado.",
      longDescription:
        "A Hisense Roku TV Full HD de 43 polegadas oferece uma experiencia completa de entretenimento com imagem nitida e recursos inteligentes. Aproveite Netflix, YouTube e outros aplicativos com o sistema Roku integrado. O design elegante e a tela vibrante tornam este modelo ideal para sala, quarto ou escritorio.\n\nESPECIFICACOES\nModelo: 43H4080F\nTamanho: 43 polegadas\nResolucao: Full HD (1080p)\nSistema inteligente: Roku TV\nConectividade: HDMI / USB / WiFi",
      category: "Eletronicos -> TVs e entretenimento domestico -> Smart TVs",
    },
  },
};

function getLocaleContent(
  translations: ProductTranslationMap | undefined,
  locale: Locale
): ProductLocaleContent | null {
  return translations?.[locale] ?? null;
}

function getAutoProductContent(
  product: StorefrontProduct,
  locale: Locale
): AutoLocalizedProductContent {
  return AUTO_PRODUCT_TRANSLATIONS[product.sku]?.[locale] ?? {};
}

function buildFallbackTranslation(
  product: StorefrontProduct,
  locale: Locale
): AutoLocalizedProductContent {
  const autoContent = getAutoProductContent(product, locale);

  return {
    name: autoContent.name || autoTranslateText(product.name, locale),
    shortDescription:
      autoContent.shortDescription || autoTranslateText(product.shortDescription, locale),
    longDescription: autoContent.longDescription || autoTranslateText(product.longDescription, locale),
    category: autoContent.category || autoTranslateText(product.category, locale),
    tags: autoContent.tags?.length ? autoContent.tags : autoTranslateList(product.tags, locale),
    inventoryLabel:
      autoContent.inventoryLabel || autoTranslateText(product.inventoryLabel, locale),
    deliveryLabel: autoContent.deliveryLabel || autoTranslateText(product.deliveryLabel, locale),
    badge: autoContent.badge || autoTranslateText(product.badge, locale),
    colors: autoContent.colors?.length ? autoContent.colors : autoTranslateList(product.colors, locale),
    variants:
      autoContent.variants?.length
        ? autoContent.variants
        : product.variants.map((variant) => ({
            name: autoTranslateText(variant.name, locale),
            details: autoTranslateText(variant.details, locale),
            color: autoTranslateText(variant.color, locale),
          })),
  };
}

function sanitizeVariantText(value: string | undefined, locale: Locale) {
  const sanitized = sanitizeLocalizedText(value);

  if (!sanitized) {
    return "";
  }

  return autoTranslateText(sanitized, locale);
}

function localizeVariant(
  variant: StorefrontProductVariant,
  locale: Locale,
  translatedVariant?: Partial<Pick<StorefrontProductVariant, "name" | "details" | "color">>
): StorefrontProductVariant {
  return {
    ...variant,
    name: sanitizeLocalizedText(translatedVariant?.name || sanitizeVariantText(variant.name, locale)),
    details: sanitizeLocalizedText(
      translatedVariant?.details || sanitizeVariantText(variant.details, locale)
    ),
    color: sanitizeLocalizedText(translatedVariant?.color || sanitizeVariantText(variant.color, locale)),
  };
}

export function localizeProduct(product: StorefrontProduct, locale: Locale): StorefrontProduct {
  const storedTranslation = getLocaleContent(product.translations, locale);
  const fallbackTranslation = buildFallbackTranslation(product, locale);

  const resolvedTags =
    storedTranslation?.tags?.length ? storedTranslation.tags : fallbackTranslation.tags;
  const resolvedColors =
    fallbackTranslation.colors?.length ? fallbackTranslation.colors : autoTranslateList(product.colors, locale);

  return {
    ...product,
    name: sanitizeLocalizedText(storedTranslation?.name || fallbackTranslation.name || product.name),
    shortDescription: sanitizeLocalizedText(
      storedTranslation?.shortDescription ||
        fallbackTranslation.shortDescription ||
        product.shortDescription
    ),
    longDescription: sanitizeLocalizedText(
      storedTranslation?.longDescription || fallbackTranslation.longDescription || product.longDescription
    ),
    category: sanitizeLocalizedText(
      storedTranslation?.category || fallbackTranslation.category || product.category
    ),
    tags: resolvedTags?.length
      ? resolvedTags.map((tag) => sanitizeLocalizedText(tag)).filter(Boolean)
      : product.tags.map((tag) => sanitizeLocalizedText(tag)).filter(Boolean),
    inventoryLabel: sanitizeLocalizedText(
      storedTranslation?.inventoryLabel || fallbackTranslation.inventoryLabel || product.inventoryLabel
    ),
    deliveryLabel: sanitizeLocalizedText(
      storedTranslation?.deliveryLabel || fallbackTranslation.deliveryLabel || product.deliveryLabel
    ),
    badge: sanitizeLocalizedText(storedTranslation?.badge || fallbackTranslation.badge || product.badge),
    colors: resolvedColors.map((color) => sanitizeLocalizedText(color)).filter(Boolean),
    variants: product.variants.map((variant, index) =>
      localizeVariant(variant, locale, fallbackTranslation.variants?.[index])
    ),
  };
}

export function getProductSearchText(product: StorefrontProduct) {
  const values = new Set<string>();

  for (const locale of SEARCH_LOCALES) {
    const localized = localizeProduct(product, locale);

    [
      localized.name,
      localized.shortDescription,
      localized.longDescription,
      localized.brand,
      localized.category,
      localized.inventoryLabel,
      localized.deliveryLabel,
      localized.badge,
      ...localized.tags,
      ...localized.colors,
      ...localized.variants.flatMap((variant) => [variant.name, variant.details, variant.color]),
    ]
      .map((value) => sanitizeLocalizedText(value))
      .filter(Boolean)
      .forEach((value) => values.add(value));
  }

  return Array.from(values).join(" ");
}
