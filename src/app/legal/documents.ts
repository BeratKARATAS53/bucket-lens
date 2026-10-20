import { Lang } from '../helpers/i18n';

export type LegalId = 'content' | 'kvkk' | 'privacy' | 'terms';

export interface LegalBlock {
	heading: string;
	body: string;
}

export interface LegalDocument {
	title: string;
	updated: string;
	blocks: LegalBlock[];
}

const tr: Record<LegalId, LegalDocument> = {
	content: {
		title: 'İçerik politikası',
		updated: '12 Ekim 2026',
		blocks: [
			{
				heading: 'Sitede ne var',
				body: 'Bu sitede uygulamanın tanıtımı, indirme bağlantıları ve örnek bir dosya listesi vardır. Örnek listedeki dosyalar tanıtım içindir.',
			},
			{
				heading: 'Kovadaki dosyalar',
				body: 'Kurduğun uygulama, Backblaze B2, Wasabi, Amazon S3 veya bir FTP sunucusunda erişimin olan dosyaları listeler. Dosyalar senin hesabında kalır. Geliştirici bu dosyaları görmez.',
			},
			{
				heading: 'Nasıl kullanılır',
				body: 'Uygulama, sana ait olan ya da bakma iznin bulunan bir kova içindir.',
			},
		],
	},
	kvkk: {
		title: 'KVKK aydınlatma metni',
		updated: '12 Ekim 2026',
		blocks: [
			{
				heading: 'Veri sorumlusu',
				body: 'D. Berat KARATAŞ.',
			},
			{
				heading: 'Hangi veri işlenir',
				body: 'Tanıtım sayfası ad, e-posta, kova adı ve gizli anahtar toplamaz. Orada seçilen dil ve görünüm bu cihazda hatırlanır. Kurulu uygulamada kova adı, bölge, anahtar kimliği, FTP adresi ve gizli anahtar ya da parola bu bilgisayarda durur.',
			},
			{
				heading: 'Amaç',
				body: 'Dil ve görünüm, siteyi bir sonraki açılışta aynı şekilde göstermek içindir. Kova bilgisi, kurduğun uygulamanın dosyalarını listelemesi içindir.',
			},
			{
				heading: 'Aktarım',
				body: 'Bu seçimler bu bilgisayarda kalır. İndirme bağlantısı GitHub’daki yayın sayfasını açar.',
			},
			{
				heading: 'Hakların',
				body: 'KVKK’nın 11. maddesi erişme, düzeltme, silme ve itirazı kapsar. Tanıtım sayfasındaki dil ve görünüm kaydını, o sayfanın bu cihazdaki verisini temizleyerek silebilirsin.',
			},
		],
	},
	privacy: {
		title: 'Gizlilik',
		updated: '12 Ekim 2026',
		blocks: [
			{
				heading: 'Site',
				body: 'Bu sitede hesap açılmaz. Ad, e-posta, kova adı veya gizli anahtar istenmez. İndirme düğmeleri GitHub’daki yayın sayfasına gider.',
			},
			{
				heading: 'Dil, görünüm ve çerez',
				body: 'Tanıtım sayfasında seçtiğin dil ile açık ya da koyu görünüm bu cihazda durur. Tanıtım sayfasında çerez, reklam veya ziyaret ölçümü yoktur.',
			},
			{
				heading: 'Uygulama',
				body: 'Kurduğun uygulama bu bilgisayarda çalışır. Anahtar bu bilgisayarda kalır. Kova adı, bölge ve anahtar kimliği de burada durur. Kova içeriği bu bilgisayarda kalır.',
			},
			{
				heading: 'Demo',
				body: 'Demo örnek bir listedir.',
			},
		],
	},
	terms: {
		title: 'Kullanım koşulları',
		updated: '12 Ekim 2026',
		blocks: [
			{
				heading: 'Ücret',
				body: 'BucketLens ücretsizdir. Backblaze, Wasabi, Amazon S3 veya FTP hesabının bedeli o sağlayıcıya aittir.',
			},
			{
				heading: 'Anahtar',
				body: 'Kendi anahtarınla bağlanırsın. Anahtarın klasörleri listeleme ve dosya okuma izni olmalı. Anahtar bu bilgisayarda kalır.',
			},
			{
				heading: 'Sistemler',
				body: 'Windows kurulum dosyasıyla gelir. Debian ve Ubuntu deb paketi kullanır. Diğer Linux dağıtımlarında tek dosya çalışır. macOS kurulumu yok. Linux’ta anahtarın kaydolması için GNOME Keyring veya KWallet açık olmalı.',
			},
			{
				heading: 'Demo',
				body: 'Demo örnek bir listedir. Kendi kovan için uygulamayı kurup anahtarı orada kaydedersin.',
			},
		],
	},
};

const en: Record<LegalId, LegalDocument> = {
	content: {
		title: 'Content policy',
		updated: '12 October 2026',
		blocks: [
			{
				heading: 'What this site shows',
				body: 'This site shows the app, download links, and a sample file list. The sample files are there for the tour.',
			},
			{
				heading: 'Files in a bucket',
				body: 'The installed app lists files you can already reach on Backblaze B2, Wasabi, Amazon S3, or an FTP server. Those files stay in your account. The developer does not see them.',
			},
			{
				heading: 'How to use it',
				body: 'The app is for a bucket you own or are allowed to read.',
			},
		],
	},
	kvkk: {
		title: 'KVKK notice',
		updated: '12 October 2026',
		blocks: [
			{
				heading: 'Data controller',
				body: 'D. Berat KARATAŞ.',
			},
			{
				heading: 'What is processed',
				body: 'The landing page does not collect your name, email, bucket name, or secret key. Language and theme chosen there are remembered on this device. In the installed app, the bucket name, region, key id, FTP address, and secret key or password stay on this computer.',
			},
			{
				heading: 'Purpose',
				body: 'Language and theme keep the site the same the next time you open it. Bucket details let the installed app list your files.',
			},
			{
				heading: 'Transfers',
				body: 'These choices stay on this computer. A download link opens the release page on GitHub.',
			},
			{
				heading: 'Your rights',
				body: 'Article 11 of the KVKK covers access, correction, deletion, and objection. You can remove the language and theme record by clearing the landing page data stored on this device.',
			},
		],
	},
	privacy: {
		title: 'Privacy',
		updated: '12 October 2026',
		blocks: [
			{
				heading: 'The site',
				body: 'This site does not ask you to create an account. It does not ask for your name, email, bucket name, or secret key. Download buttons go to the release page on GitHub.',
			},
			{
				heading: 'Language, theme, and cookies',
				body: 'Your language and light or dark theme on the landing page stay on this device. The landing page does not use cookies, ads, or visit measurement.',
			},
			{
				heading: 'The app',
				body: 'The installed app runs on this computer. The key stays on this computer, with the bucket name, region, and key id. The bucket contents stay on this computer.',
			},
			{
				heading: 'The demo',
				body: 'The demo is a sample list.',
			},
		],
	},
	terms: {
		title: 'Terms of use',
		updated: '12 October 2026',
		blocks: [
			{
				heading: 'Price',
				body: 'BucketLens is free. Any fee for a Backblaze, Wasabi, Amazon S3, or FTP account belongs to that provider.',
			},
			{
				heading: 'Your key',
				body: 'You connect with your own key. The key needs permission to list folders and read files. The key stays on this computer.',
			},
			{
				heading: 'Systems',
				body: 'Windows comes with an installer. Debian and Ubuntu use a deb package. Other Linux distributions run the single file. There is no macOS build. On Linux, GNOME Keyring or KWallet needs to be open so the key can be saved.',
			},
			{
				heading: 'The demo',
				body: 'The demo is a sample list. To open your own bucket, install the app and save the key there.',
			},
		],
	},
};

export const legalDocuments: Record<Lang, Record<LegalId, LegalDocument>> = { tr, en };
