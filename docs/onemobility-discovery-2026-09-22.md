# OneMobility - discovery meeting notes

Data di riferimento: 22 settembre 2026

## Scopo del documento

Questa nota conserva quanto emerso nella prima riunione di discovery e separa:

- obiettivi dichiarati;
- funzionalita candidate;
- decisioni effettivamente prese;
- ipotesi ancora da verificare;
- rischi tecnici, commerciali e operativi;
- relazione tra le richieste e l'MVP FleetOps gia realizzato.

Non e una specifica approvata, un preventivo o un piano di delivery.

## Limiti delle fonti

- La trascrizione `OneMobility.pdf` e automatica, non attribuisce sistematicamente gli speaker e si interrompe dopo i primi 30 minuti.
- Sono presenti errori evidenti di trascrizione. Esempi: "weighted label" sembra indicare "white label"; "fuel cup" probabilmente "fuel card"; "il cicero" probabilmente "myCicero"; "Bloomfield" e varianti indicano Bloomfleet.
- Il video dura circa 92 secondi e non contiene audio. Mostra per pochi secondi un documento commerciale, poi quasi esclusivamente la griglia dei partecipanti alla riunione.
- Le affermazioni su accordi commerciali, API, condizioni Telepass, myCicero/MooneyGo, assicurazione del credito e responsabilita verso i dipendenti devono essere confermate direttamente con le controparti e con consulenti legali/fiscali.

## Sintesi esecutiva

OneMobility vuole ottenere indipendenza tecnologica da Bloomfleet creando una piattaforma proprietaria. L'intento non e una copia puramente grafica, ma una base fleet management comparabile nelle funzioni essenziali e piu semplice da estendere.

Il tratto distintivo indicato nella riunione e il cosiddetto utilizzo duale: un driver dovrebbe poter usare gli stessi servizi di mobilita sia per finalita aziendali sia privatamente, con classificazione, fatturazione e pagamento separati.

Accanto al nucleo fleet sono state proposte estensioni rilevanti:

- auto sostitutive e pre-assegnazioni;
- noleggio a breve termine, anche a uso privato;
- quotazioni di noleggio a lungo termine;
- parcheggi prenotabili, inclusi quelli non accessibili tramite Telepass;
- pedaggi, taxi, trasporto pubblico e altri servizi di mobilita;
- welfare aziendale con credito mobilita;
- dashboard e report personalizzati per ruolo;
- gestione auto in pool, disponibilita e manutenzione;
- flussi specifici per multe, fringe benefit, contratti, chilometraggi e trattenute.

La riunione non ha ancora definito un MVP. La decisione operativa e svolgere almeno due o tre incontri di approfondimento con Paola, che conosce la piattaforma corrente e i processi fleet, per costruire un blueprint funzionale e un successivo piano di sviluppo e manutenzione.

## Obiettivi dichiarati

1. Ridurre la dipendenza tecnologica da Bloomfleet.
2. Conservare le funzioni fleet che funzionano bene nel prodotto attuale.
3. Correggere limiti di reportistica, personalizzazione ed evoluzione.
4. Aggiungere servizi OneMobility e di terze parti senza blocchi architetturali.
5. Rendere la piattaforma vendibile a clienti corporate con ruoli e viste differenti.
6. Supportare in prospettiva utilizzo aziendale, privato e welfare.

## Prodotti distinti emersi nella conversazione

Le idee discusse non costituiscono un unico flusso. Devono essere separate almeno in quattro domini.

### 1. Fleet management core

- aziende, sedi e utenti;
- veicoli, driver e assegnazioni;
- contratti e stato dei veicoli;
- transazioni, costi, fatture e ricevute;
- multe, pedaggi, carburante, ricariche, parcheggi e lavaggi;
- report operativi e finanziari;
- ruoli e permessi;
- veicoli in pool e manutenzione.

### 2. Servizi dual use aziendale/privato

- lo stesso driver usa servizi aziendali anche privatamente;
- ogni transazione deve avere una natura aziendale o privata affidabile;
- la parte privata deve essere addebitata al driver, non all'azienda;
- account, strumenti e servizi devono essere sospesi quando termina il rapporto aziendale;
- rimangono da gestire importi maturati, insoluti, contestazioni e frodi.

### 3. Welfare mobilita

- puo includere persone senza auto aziendale;
- richiede un account personale distinto dal driver fleet;
- l'azienda finanzia canoni o un plafond annuale;
- necessita di regole su eleggibilita, saldo, scadenza, fiscalita e servizi ammessi.

### 4. Marketplace e prenotazioni

- auto sostitutiva;
- noleggio breve e lungo termine;
- parcheggi prenotabili;
- quotazioni e comparazione;
- eventuali altri operatori oltre alle societa del gruppo;
- disponibilita, prenotazione, pagamento, cancellazione e assistenza.

Questi domini possono condividere identita, catalogo e ledger, ma non devono essere trattati come una singola feature.

## Il tema Telepass, in termini concreti

### Cosa e stato detto

- Stefano sta cercando un contatto diretto con Telepass.
- E stata espressa l'opinione che Telepass sia sotto pressione per l'evoluzione dei pagamenti e dell'uso dei dati.
- E stato citato un accordo con Telecom Italia/TIM e il precedente professionale dell'amministratore delegato. La relazione causale espressa nella riunione e un'ipotesi personale, non un requisito verificato.
- Per pedaggi, taxi, parcheggi e altri servizi e stato citato myCicero come possibile aggregatore o fornitore di integrazioni.
- Per abilitare il dual use si ipotizza che apparati e servizi siano contrattualmente intestati a OneMobility, che riceve i dati, separa gli utilizzi e rifattura la quota privata al driver.

### Cosa significa per la piattaforma

Telepass non e semplicemente una voce del catalogo. Un'integrazione reale puo richiedere:

1. accordo commerciale e diritto di distribuire o gestire gli apparati;
2. anagrafica e assegnazione apparato-veicolo-driver;
3. importazione periodica o quasi real-time delle transazioni;
4. normalizzazione di pedaggi, parcheggi e altri servizi;
5. classificazione aziendale/privata, automatica o confermata dal driver;
6. riconciliazione tra transazioni, fatture del fornitore e addebiti;
7. gestione di resi, smarrimenti, sostituzioni e cessazioni;
8. contestazioni, rimborsi e correzioni;
9. privacy, conservazione e accesso ai dati di localizzazione/viaggio;
10. assistenza operativa e livelli di servizio.

### Il nodo economico del dual use

Se OneMobility e intestataria dei servizi e poi addebita il dipendente, assume almeno parte del rischio operativo e di credito. Il semplice RID/addebito SEPA non elimina:

- mancati pagamenti o revoche;
- transazioni effettuate prima del blocco account;
- contestazioni e chargeback;
- errori di classificazione tra aziendale e privato;
- recupero del credito;
- obblighi di fatturazione e trattamento IVA;
- responsabilita tra OneMobility, azienda cliente, driver e fornitore;
- eventuali requisiti regolamentari relativi a pagamenti e intermediazione.

L'eventuale assicurazione del credito puo mitigare una parte del rischio, ma non sostituisce il disegno dei flussi contrattuali, contabili e di incasso.

### Domande da porre a Telepass o a un aggregatore

- Quali prodotti e transazioni sono accessibili tramite integrazione?
- Esistono API, feed, file di rendicontazione o webhook documentati?
- Qual e la latenza dei dati?
- Quali identificativi collegano apparato, veicolo, driver, azienda e transazione?
- E consentita una piattaforma white label?
- Chi firma il contratto e chi riceve la fattura?
- E ammessa la separazione tra utilizzo aziendale e privato?
- Come sono gestiti parcheggi, pedaggi esteri, rimborsi e storni?
- Come funzionano provisioning, sostituzione e blocco degli apparati?
- Quali costi, minimi, SLA e vincoli di volume si applicano?
- Quali dati personali e di viaggio possono essere trattati e per quanto tempo?

## Criticita principali

### Perimetro non ancora definito

La conversazione alterna fleet management, welfare, pagamenti, marketplace, noleggio e comparazione. Senza una separazione per fasi, il progetto rischia di diventare troppo ampio prima di validare il nucleo.

### Dipendenze commerciali prima del software

Telepass, carburante, parcheggi, taxi, noleggiatori e sistemi di pagamento richiedono accordi e disponibilita di dati. Non bisogna promettere funzionalita basandosi sull'ipotesi che esista un "plugin" immediatamente utilizzabile.

### Pagamenti e rifatturazione privata

Sono il vero elemento distintivo, ma anche la parte con maggiore rischio legale, fiscale e operativo. Devono essere progettati prima di implementare il dual use.

### Confusione tra account fleet e account welfare

Il driver con auto aziendale e il beneficiario welfare senza auto aziendale sono identita e relazioni contrattuali differenti. Il modello dati e i permessi devono supportarle senza forzarle nello stesso profilo.

### Proprietario del servizio e responsabilita

Non e ancora chiaro se OneMobility sara marketplace, reseller, mandatario, intestatario dei servizi o semplice fornitore software. La risposta cambia fatture, incassi, assistenza, rischio credito e compliance.

### Benchmark e proprieta intellettuale

Bloomfleet deve essere usata come benchmark funzionale, non come sorgente da copiare. Il blueprint deve documentare bisogni e processi in modo indipendente, evitando codice, asset, testi, struttura proprietaria o informazioni riservate non autorizzate.

### Reportistica e qualita dei dati

La reportistica e indicata come debolezza del prodotto corrente e possibile vantaggio competitivo. Prima servono pero ownership, frequenza, qualita e riconciliazione delle fonti.

### Web app e applicazione mobile

Una web app responsive o PWA e una scelta valida per l'MVP, ma non si "trasforma" automaticamente in un'app nativa. Backend, modello dati e parte della logica possono essere riutilizzati; esperienza mobile, notifiche push, accesso sicuro al dispositivo, store e funzioni native possono richiedere lavoro dedicato.

### Manutenzione continua

Il prodotto richiedera monitoraggio, sicurezza, aggiornamenti, supporto, riconciliazioni, gestione fornitori e modifiche a regole su contratti, chilometri, trattenute e fringe benefit. Non e realistico considerarlo autosufficiente dopo il rilascio.

## Decisioni e orientamenti emersi

- Iniziare dal fleet management core e dai servizi privati collegati alla flotta.
- Rimandare il welfare completo a una fase successiva, mantenendo l'architettura estensibile.
- Usare inizialmente una web app e valutare successivamente l'esperienza mobile.
- Organizzare almeno due o tre sessioni operative con Paola.
- Definire ruoli, permessi e i primi tre problemi da risolvere nell'MVP.
- Redigere una matrice funzionale: mantenere, modificare, aggiungere, rimandare.
- Preparare in seguito un piano separato per sviluppo, gestione e manutenzione.

## Mappatura rispetto all'MVP FleetOps attuale

### Gia presente

- separazione dei dati per azienda;
- autenticazione e ruoli;
- veicoli, driver e assegnazioni;
- inviti e ciclo di vita degli account;
- catalogo servizi;
- inserimento spese driver;
- classificazione business/personal;
- ricevute private;
- approvazione, rifiuto, notifiche e audit trail;
- dashboard, report ed export CSV;
- persistenza e controlli di sicurezza.

### Presente solo come base concettuale

- utilizzo privato: esiste la classificazione, non il pagamento separato;
- catalogo servizi: esiste, ma non ci sono integrazioni reali con provider;
- limiti e regole: sono visualizzati, ma non completamente configurabili o applicati;
- account bloccati: supportati, ma non collegati a strumenti e contratti esterni;
- report per ruolo: presenti in forma iniziale, non ancora customizzabili per cliente/sede.

### Non ancora presente

- Telepass e gestione apparati;
- importazione e riconciliazione automatica delle transazioni;
- SEPA/RID, pagamenti, fatturazione privata e recupero credito;
- contratti privati del driver;
- welfare e wallet/plafond;
- auto sostitutiva e prenotazione short term;
- noleggio lungo termine e quotazioni;
- marketplace multi-provider;
- parcheggi prenotabili esterni a Telepass;
- flotta in pool con calendario e disponibilita;
- gestione specializzata di multe, contratti, chilometri, fringe benefit e trattenute;
- ingestion di fatture e costi esterni;
- dashboard configurabili per global fleet manager, sede, segreteria e driver.

## Valutazione degli interventi attribuibili a Serena

L'attribuzione non e certa perche il PDF non contiene speaker label. Le osservazioni che sembrano essere di Serena sono complessivamente corrette e metodologicamente solide.

### Corretto

- Chiedere di contestualizzare l'obiettivo prima di emulare funzionalita.
- Chiedere quale sia il presunto impedimento tecnico: gli interlocutori hanno ammesso di non conoscerlo.
- Proporre drill-down separati invece di affrontare tutto insieme.
- Partire dal fleet management core.
- Chiedere ruoli, permessi e i primi tre problemi da risolvere.
- Proporre un MVP scalabile invece di includere subito tutto.
- Chiedere se una web app sia sufficiente nella prima fase.

### Da precisare in futuro

- Usare "benchmark funzionale" o "requisiti indipendenti" invece di "replicare/emulare", per evitare ambiguita su proprieta intellettuale e perimetro.
- Non assumere che una web app possa essere convertita automaticamente in app mobile; e meglio parlare di backend condiviso e strategia mobile progressiva.
- Distinguere sempre feature software da prerequisiti commerciali, legali e operativi.

Non emerge una vera inesattezza grave attribuibile con sicurezza a Serena. Le sue domande hanno anzi portato la discussione verso scope, ruoli, permessi, priorita e MVP. Il limite principale e che la trascrizione rende impossibile attribuire ogni frase con certezza.

Correzione fornita da Serena: la frase secondo cui integrare i parcheggi richiederebbe "tra il poco e il niente" non era sua. L'affermazione rimane da validare come ipotesi espressa da un altro partecipante, perche un'integrazione reale dipende da API, accordi, pagamenti, riconciliazioni e supporto.

## Orientamento di lavoro prima dell'incontro con Paola

Serena propone di concentrare l'MVP, o almeno il lavoro preparatorio precedente alla sessione con Paola, esclusivamente sul fleet management tradizionale.

Questo orientamento e coerente con quanto emerso nella discovery:

- e il dominio meglio conosciuto dagli interlocutori;
- permette di validare utenti, ruoli e processi reali;
- riduce le dipendenze immediate da accordi con provider e sistemi di pagamento;
- crea la base dati e operativa necessaria per le estensioni successive;
- consente di usare l'incontro con Paola per confrontare il prototipo con il lavoro quotidiano di un fleet manager.

Il termine "emulare" deve indicare la copertura indipendente delle esigenze funzionali, non la riproduzione di interfacce, asset o logiche proprietarie di Bloomfleet.

La base tecnica dovra preservare fin dall'inizio alcuni confini:

- API indipendenti dall'interfaccia web;
- identita, ruoli e permessi estensibili;
- isolamento multi-azienda;
- servizi/provider separati dal nucleo fleet;
- ledger delle transazioni progettato per nuove fonti e classificazioni;
- audit trail e notifiche riutilizzabili;
- moduli futuri di booking, welfare e pagamenti non incorporati direttamente nelle anagrafiche fleet;
- frontend responsive, con backend riutilizzabile da un futuro client mobile.

L'obiettivo non e implementare ora i prodotti futuri, ma evitare decisioni strutturali che li rendano costosi o rischiosi da aggiungere.

## Osservazioni sul video

Nei primi secondi viene mostrata una pagina di un documento commerciale intitolata, per quanto leggibile, "App white label RENTALPLUS con funzionalita di noleggio e sosta strisce blu".

La pagina mostra:

- un blocco una tantum da 25.000 euro per app white label e integrazione servizi RentalPlus;
- attivita come project management, personalizzazione UX/UI, configurazione frontend/backend, test, rilascio, assistenza e onboarding;
- un'opzione da 5.000 euro per servizi ferroviari/interregionali/marittimi;
- un'opzione da 5.000 euro per TPL, sharing e taxi.

Questo sembra un estratto di offerta economica o benchmark esterno, non una schermata della piattaforma Bloomfleet. Non deve essere trattato come stima del progetto OneMobility senza conoscere anno, perimetro, deliverable, dipendenze, canoni e condizioni dell'offerta.

## Prossimi incontri consigliati

### Sessione 1 - processi fleet correnti

- anagrafiche e gerarchie aziendali;
- ruoli reali e permessi;
- veicoli, driver, pool e assegnazioni;
- contratti, manutenzione, multe e fringe benefit;
- report usati ogni giorno;
- dimostrazione completa della piattaforma attuale.

Output: matrice `keep / change / add / later`.

### Sessione 2 - servizi e dual use

- elenco provider e accordi esistenti;
- ciclo completo di una transazione;
- business vs personal;
- fatture, incassi, riconciliazioni e insoluti;
- blocco e cessazione account;
- responsabilita di OneMobility e dell'azienda cliente.

Output: service blueprint e diagramma dei flussi economici.

### Sessione 3 - scelta MVP

- tre problemi prioritari;
- utenti iniziali;
- dataset e integrazioni disponibili;
- criteri di successo;
- esclusioni esplicite;
- rollout pilota e responsabilita operative.

Output: scope MVP approvabile e backlog per fasi.

## Domande ancora aperte

- Chi e il cliente contrattuale della piattaforma?
- Chi e intestatario di apparati, carte e servizi?
- Chi fattura l'utilizzo privato e chi sopporta l'insoluto?
- Quali provider hanno gia accordi utilizzabili?
- Quali dati e interfacce sono realmente disponibili?
- Come viene classificata una transazione business/personal?
- Chi puo correggere o contestare la classificazione?
- Quali ruoli servono per azienda, sede e gruppo?
- Quali sono i tre flussi indispensabili per il primo cliente pilota?
- Quale parte deve essere web responsive e quale necessita davvero di app nativa?
- Quali dati della piattaforma corrente possono essere usati legalmente nel discovery?
- Quali SLA, supporto e processi di manutenzione si aspettano?
