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
		updated: '11 Ekim 2026',
		blocks: [
			{
				heading: 'Sitede ne var',
				body: 'Bu sitede uygulamanın tanıtımı, indirme bağlantıları ve örnek bir dosya listesi vardır. Örnek listedeki dosyalar tanıtım içindir. Bir kullanıcının kovası değildir.',
			},
			{
				heading: 'Kovadaki dosyalar',
				body: 'Kurduğun uygulama, Backblaze B2, Wasabi veya Amazon S3 üzerinde senin erişimin olan dosyaları listeler. Bu dosyalar burada barındırılmaz. Geliştirici onları görmez.',
			},
			{
				heading: 'Nasıl kullanılır',
				body: 'Uygulama, sana ait olan ya da bakma iznin bulunan bir kova içindir. Başkasının kovasına, sana ait olmayan bir anahtarla bakmak bu uygulamanın kullanım amacı değildir.',
			},
		],
	},
	kvkk: {
		title: 'KVKK aydınlatma metni',
		updated: '11 Ekim 2026',
		blocks: [
			{
				heading: 'Veri sorumlusu',
				body: 'D. Berat KARATAŞ.',
			},
			{
				heading: 'Hangi veri işlenir',
				body: 'Site; ad, e-posta, kova adı ve gizli anahtar toplamaz. Dilin ve açık ya da koyu görünümün tarayıcının yerel deposunda kalır, geliştiriciye iletilmez. Kurulu uygulamada kova adı, bölge, anahtar kimliği ve gizli anahtar senin bilgisayarında durur.',
			},
			{
				heading: 'Amaç',
				body: 'Dil ve görünüm seçimi, siteyi bir sonraki açılışta aynı şekilde göstermek içindir. Kova bilgisi, kurduğun uygulamanın senin dosyalarını listelemesi içindir.',
			},
			{
				heading: 'Aktarım',
				body: 'Bu seçimler bir sunucuya aktarılmaz. İndirme bağlantısı GitHub’daki yayın sayfasını açar.',
			},
		],
	},
	privacy: {
		title: 'Gizlilik',
		updated: '11 Ekim 2026',
		blocks: [
			{
				heading: 'Site',
				body: 'Bu sitede hesap açılmaz. Ad, e-posta, kova adı veya gizli anahtar istenmez. İndirme düğmeleri GitHub’daki yayın sayfasına gider.',
			},
			{
				heading: 'Dil, görünüm ve çerez',
				body: 'Seçtiğin dil ile açık ya da koyu görünüm tarayıcının yerel deposunda durur. Bu bilgi geliştiriciye gönderilmez. Sitede çerez, reklam veya ziyaret ölçümü yoktur.',
			},
			{
				heading: 'Uygulama',
				body: 'Kurduğun uygulama senin bilgisayarında çalışır. Gizli anahtar bu sitede durmaz; uygulamada, senin bilgisayarında kalır. Kova adı, bölge ve anahtar kimliği de aynı bilgisayarda tutulur. Kova içeriği geliştiricinin sunucusuna gelmez.',
			},
			{
				heading: 'Demo',
				body: 'Demo örnek dosyalardan oluşan bir listedir. Anahtar eklenemez.',
			},
		],
	},
	terms: {
		title: 'Kullanım koşulları',
		updated: '11 Ekim 2026',
		blocks: [
			{
				heading: 'Ücret',
				body: 'BucketLens ücretsizdir. Backblaze, Wasabi veya Amazon S3 hesabının bedeli o sağlayıcıya aittir.',
			},
			{
				heading: 'Anahtar',
				body: 'Hesap açmana gerek yok. Kendi anahtarınla bağlanırsın. Anahtarın klasörleri listeleme ve dosya okuma izni taşımalıdır. Anahtar, kurduğun uygulamada senin bilgisayarında kalır.',
			},
			{
				heading: 'Sistemler',
				body: 'Windows için kurulum dosyası, Debian ve Ubuntu için deb paketi, diğer Linux dağıtımları için tek dosya vardır. macOS için kurulum yoktur. Linux’ta anahtarın kaydolması için GNOME Keyring veya KWallet açık olmalıdır.',
			},
			{
				heading: 'Demo',
				body: 'Demo kendi kovanı açmaz. Kendi dosyaların için uygulamayı kurup anahtarı orada kaydedersin.',
			},
		],
	},
};

const en: Record<LegalId, LegalDocument> = {
	content: {
		title: 'Content policy',
		updated: '11 October 2026',
		blocks: [
			{
				heading: 'What this site shows',
				body: 'This site shows the app, download links, and a sample file list. The sample files are for the tour. They are not someone’s bucket.',
			},
			{
				heading: 'Files in a bucket',
				body: 'The installed app lists files you can already reach on Backblaze B2, Wasabi, or Amazon S3. Those files are not hosted here. The developer does not see them.',
			},
			{
				heading: 'How to use it',
				body: 'The app is for a bucket you own or are allowed to read. Looking into someone else’s bucket with a key that is not yours is outside what this app is for.',
			},
		],
	},
	kvkk: {
		title: 'KVKK notice',
		updated: '11 October 2026',
		blocks: [
			{
				heading: 'Data controller',
				body: 'D. Berat KARATAŞ.',
			},
			{
				heading: 'What is processed',
				body: 'The site does not collect your name, email, bucket name, or secret key. Your language and light or dark theme stay in the browser’s local storage and are not sent to the developer. In the installed app, the bucket name, region, key id, and secret key stay on your computer.',
			},
			{
				heading: 'Purpose',
				body: 'The language and theme choices keep the site the same the next time you open it. Bucket details exist so the installed app can list your files.',
			},
			{
				heading: 'Transfers',
				body: 'These choices are not sent to a server. A download link opens the release page on GitHub.',
			},
			{
				heading: 'Your rights',
				body: 'Article 11 of the KVKK covers access, correction, deletion, and objection. You can remove the language and theme record by clearing this site’s data in your browser.',
			},
		],
	},
	privacy: {
		title: 'Privacy',
		updated: '11 October 2026',
		blocks: [
			{
				heading: 'The site',
				body: 'This site does not ask you to create an account. It does not ask for your name, email, bucket name, or secret key. Download buttons go to the release page on GitHub.',
			},
			{
				heading: 'Language, theme, and cookies',
				body: 'Your language and light or dark theme stay in the browser’s local storage. That choice is not sent to the developer. The site does not use cookies, ads, or visit measurement.',
			},
			{
				heading: 'The app',
				body: 'The installed app runs on your computer. Your secret key is not stored on this site. It stays in the app on your computer, with the bucket name, region, and key id. The contents of the bucket are not sent to the developer’s server.',
			},
			{
				heading: 'The demo',
				body: 'The demo is a sample list of files. A key cannot be added there.',
			},
		],
	},
	terms: {
		title: 'Terms of use',
		updated: '11 October 2026',
		blocks: [
			{
				heading: 'Price',
				body: 'BucketLens is free. Any fee for a Backblaze, Wasabi, or Amazon S3 account belongs to that provider.',
			},
			{
				heading: 'Your key',
				body: 'You do not create an account here. You connect with your own key. The key needs permission to list folders and read files. It stays in the installed app on your computer.',
			},
			{
				heading: 'Systems',
				body: 'Windows has an installer. Debian and Ubuntu use a deb package. Other Linux distributions can run the single file. There is no macOS download. On Linux, GNOME Keyring or KWallet needs to be unlocked so the key can be saved.',
			},
			{
				heading: 'The demo',
				body: 'The demo does not open your bucket. To see your own files, install the app and save the key there.',
			},
		],
	},
};

export const legalDocuments: Record<Lang, Record<LegalId, LegalDocument>> = { tr, en };
