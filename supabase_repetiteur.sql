-- ============================================================
-- BLOC F — Super Répétiteur Kalamundi
-- Tables : programmes_etude, questions, resultats_sim
-- ============================================================

-- ── Table programmes_etude ──────────────────────────────────
CREATE TABLE IF NOT EXISTS programmes_etude (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  examen      TEXT NOT NULL,
  serie       TEXT,
  date_examen DATE NOT NULL,
  niveaux     JSONB DEFAULT '{}',   -- { "Mathématiques": 3, "Physique-Chimie": 2, ... }
  planning    JSONB DEFAULT '[]',   -- planning généré (semaines + sessions)
  actif       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)  -- un seul programme actif par élève
);

-- ── Table questions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS questions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  examen            TEXT NOT NULL,    -- BAC, Probatoire, BEPC
  serie             TEXT,             -- C, D, A, B, G1... NULL = toutes séries
  matiere           TEXT NOT NULL,
  theme             TEXT,             -- sous-thème
  niveau            INT DEFAULT 2 CHECK (niveau BETWEEN 1 AND 5),
  enonce            TEXT NOT NULL,
  choix             JSONB NOT NULL,   -- ["choix A", "choix B", "choix C", "choix D"]
  reponse_correcte  INT NOT NULL,     -- index 0-3
  explication       TEXT,
  annee_bac         INT,
  visible           BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ── Table resultats_sim ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS resultats_sim (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  examen          TEXT,
  serie           TEXT,
  matiere         TEXT NOT NULL,
  nb_questions    INT NOT NULL,
  nb_correct      INT NOT NULL,
  score           NUMERIC(5,2),       -- pourcentage
  lacunes         JSONB DEFAULT '[]', -- themes échoués
  reponses        JSONB DEFAULT '[]', -- [{question_id, choix_donne, correct}]
  duree_secondes  INT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE programmes_etude ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE resultats_sim     ENABLE ROW LEVEL SECURITY;

-- Programmes : chaque élève gère le sien
CREATE POLICY "prog_select" ON programmes_etude FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "prog_insert" ON programmes_etude FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "prog_update" ON programmes_etude FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "prog_delete" ON programmes_etude FOR DELETE USING (auth.uid() = user_id);

-- Questions : lecture publique
CREATE POLICY "questions_select" ON questions FOR SELECT USING (visible = true);
CREATE POLICY "questions_admin"  ON questions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Résultats : chaque élève voit les siens
CREATE POLICY "res_select" ON resultats_sim FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "res_insert" ON resultats_sim FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── Index ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_prog_user       ON programmes_etude(user_id);
CREATE INDEX IF NOT EXISTS idx_q_matiere       ON questions(matiere);
CREATE INDEX IF NOT EXISTS idx_q_serie         ON questions(serie);
CREATE INDEX IF NOT EXISTS idx_q_theme         ON questions(theme);
CREATE INDEX IF NOT EXISTS idx_res_user        ON resultats_sim(user_id);
CREATE INDEX IF NOT EXISTS idx_res_matiere     ON resultats_sim(matiere);

-- ============================================================
-- SEED — Questions QCM (54 questions de départ)
-- ============================================================

INSERT INTO questions (examen, serie, matiere, theme, niveau, enonce, choix, reponse_correcte, explication) VALUES

-- ── MATHÉMATIQUES Série C/D ──────────────────────────────────

('BAC','C','Mathématiques','Fonctions et dérivées',2,
 'La dérivée de f(x) = x³ − 3x² + 2x est :',
 '["3x² − 6x + 2","3x² + 6x − 2","x² − 6x + 2","3x³ − 6x"]',
 0,'On dérive terme à terme : (x³)'' = 3x², (−3x²)'' = −6x, (2x)'' = 2. Donc f''(x) = 3x² − 6x + 2.'),

('BAC','C','Mathématiques','Limites',2,
 'lim(x→+∞) (2x² + 3x) / (x² − 1) =',
 '["0","2","+∞","1"]',
 1,'On divise numérateur et dénominateur par x² : (2 + 3/x) / (1 − 1/x²) → 2/1 = 2.'),

('BAC','C','Mathématiques','Suites numériques',3,
 'Une suite géométrique a pour premier terme u₀ = 3 et pour raison q = 2. Le terme u₃ est :',
 '["12","24","6","9"]',
 1,'u₃ = u₀ × q³ = 3 × 2³ = 3 × 8 = 24.'),

('BAC','C','Mathématiques','Suites numériques',2,
 'La somme des 10 premiers termes d''une suite arithmétique de premier terme 1 et de raison 2 est :',
 '["55","100","45","110"]',
 1,'S₁₀ = 10/2 × (2×1 + 9×2) = 5 × 20 = 100.'),

('BAC','C','Mathématiques','Probabilités',2,
 'On tire une carte au hasard dans un jeu de 52 cartes. La probabilité de tirer un as est :',
 '["1/52","1/13","1/4","1/26"]',
 1,'Il y a 4 as sur 52 cartes : P = 4/52 = 1/13.'),

('BAC','C','Mathématiques','Probabilités',3,
 'Deux événements A et B sont indépendants si et seulement si :',
 '["P(A∩B) = P(A) + P(B)","P(A∩B) = P(A) × P(B)","P(A∪B) = P(A) × P(B)","P(A) = P(B)"]',
 1,'Par définition de l''indépendance : P(A∩B) = P(A) × P(B).'),

('BAC','C','Mathématiques','Géométrie',2,
 'Le volume d''une sphère de rayon r est :',
 '["4πr²","(4/3)πr³","2πr²","πr³"]',
 1,'La formule du volume d''une sphère est V = (4/3)πr³.'),

('BAC','C','Mathématiques','Géométrie',1,
 'Dans un triangle rectangle, si les deux côtés de l''angle droit mesurent 3 cm et 4 cm, l''hypoténuse mesure :',
 '["7 cm","12 cm","5 cm","25 cm"]',
 2,'Théorème de Pythagore : c² = 3² + 4² = 9 + 16 = 25, donc c = 5 cm.'),

-- ── PHYSIQUE-CHIMIE Série C ──────────────────────────────────

('BAC','C','Physique-Chimie','Mécanique',2,
 'Un objet de masse 5 kg est soumis à une force nette de 20 N. Son accélération est :',
 '["100 m/s²","25 m/s²","4 m/s²","0,25 m/s²"]',
 2,'2ème loi de Newton : a = F/m = 20/5 = 4 m/s².'),

('BAC','C','Physique-Chimie','Mécanique',1,
 'Un objet part du repos avec une accélération de 3 m/s². Sa vitesse après 5 secondes est :',
 '["8 m/s","15 m/s","1,67 m/s","3 m/s"]',
 1,'v = at = 3 × 5 = 15 m/s (mouvement uniformément accéléré, v₀ = 0).'),

('BAC','C','Physique-Chimie','Électricité',2,
 'La tension aux bornes d''un conducteur ohmique de résistance 10 Ω parcouru par un courant de 2 A est :',
 '["5 V","12 V","0,2 V","20 V"]',
 3,'Loi d''Ohm : U = R × I = 10 × 2 = 20 V.'),

('BAC','C','Physique-Chimie','Optique',2,
 'La vitesse de la lumière dans le vide est approximativement :',
 '["300 000 km/s","30 000 km/s","3 000 km/s","300 km/s"]',
 0,'La lumière voyage à c ≈ 3×10⁸ m/s = 300 000 km/s dans le vide.'),

('BAC','C','Physique-Chimie','Chimie des solutions',2,
 'Le pH d''une solution neutre à 25°C est :',
 '["0","7","14","10"]',
 1,'Une solution neutre a [H⁺] = [OH⁻] = 10⁻⁷ mol/L, donc pH = 7.'),

('BAC','C','Physique-Chimie','Chimie des solutions',2,
 'Une solution acide a un pH :',
 '["supérieur à 7","égal à 7","inférieur à 7","égal à 0"]',
 2,'pH < 7 pour une solution acide, pH > 7 pour une base, pH = 7 pour une solution neutre.'),

-- ── SVT Série D ──────────────────────────────────────────────

('BAC','D','SVT','Génétique',2,
 'Dans un croisement entre deux hétérozygotes (Aa × Aa), la proportion d''individus AA dans la descendance est :',
 '["1/4","1/2","3/4","0"]',
 0,'Le carré de Punnett donne : 1/4 AA, 2/4 Aa, 1/4 aa. Donc P(AA) = 1/4.'),

('BAC','D','SVT','Génétique',3,
 'Un individu de génotype AaBb est croisé avec aabb. Combien de phénotypes différents dans la descendance (gènes indépendants) ?',
 '["1","2","3","4"]',
 3,'Croisement test avec dihybride : on obtient 4 combinaisons phénotypiques : AB, Ab, aB, ab.'),

('BAC','D','SVT','Immunologie',2,
 'Les anticorps sont produits par les :',
 '["Érythrocytes","Plaquettes","Lymphocytes B","Neutrophiles"]',
 2,'Les plasmocytes, issus des lymphocytes B activés, synthétisent les anticorps.'),

('BAC','D','SVT','Immunologie',2,
 'Le vaccin confère une immunité :',
 '["Naturelle passive","Artificielle active","Naturelle active","Artificielle passive"]',
 1,'Un vaccin introduit un antigène pour stimuler le système immunitaire → immunité artificielle active.'),

('BAC','D','SVT','Écologie',1,
 'La photosynthèse se déroule dans :',
 '["La mitochondrie","Le noyau","Le chloroplaste","Le ribosome"]',
 2,'La photosynthèse se déroule dans les chloroplastes grâce à la chlorophylle.'),

('BAC','D','SVT','Physiologie',2,
 'Le rôle de l''insuline est de :',
 '["Augmenter la glycémie","Diminuer la glycémie","Augmenter la température","Stimuler la croissance"]',
 1,'L''insuline, sécrétée par le pancréas, fait entrer le glucose dans les cellules et abaisse la glycémie.'),

-- ── CHIMIE Série D ───────────────────────────────────────────

('BAC','D','Chimie','Solutions aqueuses',2,
 'La constante d''équilibre d''une réaction est supérieure à 1. Cela signifie que la réaction est :',
 '["Défavorisée dans le sens direct","Favorable dans le sens direct","À l''équilibre","Irréversible"]',
 1,'K > 1 signifie que les produits sont majoritaires à l''équilibre, donc la réaction est favorisée.'),

('BAC','D','Chimie','Réactions chimiques',1,
 'Dans la réaction : 2H₂ + O₂ → 2H₂O, pour consommer 4 mol de H₂, il faut :',
 '["1 mol de O₂","2 mol de O₂","4 mol de O₂","0,5 mol de O₂"]',
 1,'La stœchiométrie donne 2H₂ pour 1O₂. Pour 4 mol de H₂, il faut 4/2 = 2 mol de O₂.'),

('BAC','D','Chimie','Solutions aqueuses',2,
 'La concentration molaire d''une solution obtenue en dissolvant 58,5 g de NaCl (M = 58,5 g/mol) dans 1 L d''eau est :',
 '["0,5 mol/L","1 mol/L","2 mol/L","58,5 mol/L"]',
 1,'n = m/M = 58,5/58,5 = 1 mol. C = n/V = 1/1 = 1 mol/L.'),

('BAC','D','Chimie','Chimie organique',3,
 'La formule générale des alcanes est :',
 '["CₙH₂ₙ","CₙH₂ₙ₋₂","CₙH₂ₙ₊₂","CₙHₙ"]',
 2,'Les alcanes (hydrocarbures saturés) ont la formule générale CₙH₂ₙ₊₂.'),

-- ── FRANÇAIS (toutes séries) ─────────────────────────────────

('BAC',NULL,'Français','Grammaire',2,
 '"Bien que Paul soit malade" est une proposition :',
 '["Causale","Concessive","Conditionnelle","Consécutive"]',
 1,'"Bien que" introduit une concession. La proposition exprime un fait malgré lequel l''action principale se produit.'),

('BAC',NULL,'Français','Grammaire',1,
 'Le mode du verbe dans "Il faut que tu travailles" est :',
 '["Indicatif","Conditionnel","Subjonctif","Impératif"]',
 2,'Les locutions "il faut que", "bien que", "pour que" imposent le subjonctif.'),

('BAC',NULL,'Français','Expression écrite',2,
 'Le plan dialectique (thèse-antithèse-synthèse) est principalement utilisé pour :',
 '["Le récit de vie","La dissertation critique","Le résumé","La narration"]',
 1,'La dissertation critique utilise le plan dialectique pour examiner une question sous plusieurs angles.'),

('BAC',NULL,'Français','Littérature',2,
 'Quel procédé stylistique est utilisé dans "La neige tombe en silence" ?',
 '["Métaphore","Allitération","Personnification","Antithèse"]',
 1,'L''allitération est la répétition de sons consonantiques identiques : ici le son [s] dans "silence".'),

('BAC',NULL,'Français','Compréhension',1,
 'La paraphrase dans un commentaire de texte est :',
 '["Recommandée","À éviter","Obligatoire","Optionnelle"]',
 1,'La paraphrase consiste à redire le texte sans l''analyser. Elle est à éviter dans un commentaire.'),

('BAC',NULL,'Français','Grammaire',2,
 '"Les enfants que j''ai vus jouer" — le participe passé "vus" est :',
 '["Invariable","Accordé avec \"enfants\"","Accordé avec \"jouer\"","Accordé avec le sujet"]',
 1,'Le participe passé s''accorde avec le COD "que" mis pour "enfants" (masculin pluriel) s''il est placé avant avoir.'),

-- ── PHILOSOPHIE (toutes séries) ──────────────────────────────

('BAC',NULL,'Philosophie','Connaissance',2,
 'Selon Descartes, le cogito signifie :',
 '["L''homme est un loup pour l''homme","Je pense donc je suis","Connais-toi toi-même","L''enfer c''est les autres"]',
 1,'"Cogito ergo sum" — Descartes utilise le doute méthodique et conclut que la pensée prouve l''existence du sujet.'),

('BAC',NULL,'Philosophie','Morale',2,
 'L''impératif catégorique de Kant est :',
 '["Agis selon tes désirs","Agis selon l''utilité","Agis selon une maxime universalisable","Agis pour le bonheur d''autrui"]',
 2,'Kant : "Agis seulement d''après la maxime grâce à laquelle tu peux vouloir en même temps qu''elle devienne une loi universelle."'),

('BAC',NULL,'Philosophie','Politique',2,
 'Pour Rousseau, le contrat social vise à :',
 '["Justifier la monarchie absolue","Fonder la légitimité du pouvoir sur la volonté générale","Éliminer l''État","Protéger la propriété privée"]',
 1,'Rousseau fonde la légitimité politique sur la volonté générale — expression de l''intérêt commun.'),

('BAC',NULL,'Philosophie','Existence',2,
 'L''existentialisme de Sartre affirme que :',
 '["L''essence précède l''existence","L''existence précède l''essence","L''homme est déterminé par sa nature","Dieu définit l''essence humaine"]',
 1,'Sartre : "L''existence précède l''essence" — l''homme se définit par ses actes, pas par une nature préétablie.'),

-- ── ÉCONOMIE Série B ─────────────────────────────────────────

('BAC','B','Économie','Marchés',1,
 'La loi de la demande stipule que, toutes choses égales par ailleurs, quand le prix augmente, la quantité demandée :',
 '["Augmente","Diminue","Reste constante","Double"]',
 1,'La relation prix-demande est inverse : si le prix monte, les consommateurs achètent moins.'),

('BAC','B','Économie','Macroéconomie',2,
 'Le PIB mesure :',
 '["La richesse des ménages","La valeur des importations","La valeur ajoutée créée dans un pays sur une période","Les dépenses publiques uniquement"]',
 2,'Le PIB (Produit Intérieur Brut) = somme des valeurs ajoutées produites sur le territoire national.'),

('BAC','B','Économie','Monnaie',2,
 'L''inflation désigne :',
 '["Une baisse générale des prix","Une hausse générale et durable des prix","Une augmentation du chômage","Une baisse de la production"]',
 1,'L''inflation est une augmentation générale et durable du niveau des prix, qui érode le pouvoir d''achat.'),

('BAC','B','Économie','Commerce international',2,
 'La théorie des avantages comparatifs a été développée par :',
 '["Adam Smith","Karl Marx","David Ricardo","John Maynard Keynes"]',
 2,'David Ricardo (1817) a développé la théorie des avantages comparatifs pour justifier le libre-échange.'),

('BAC','B','Économie','Macroéconomie',3,
 'Dans le circuit économique, les ménages offrent principalement :',
 '["Des biens et services","Du travail et du capital","Des impôts","Des importations"]',
 1,'Les ménages mettent à disposition leur travail (facteur travail) et leur épargne (capital) sur les marchés des facteurs.'),

('BAC','B','Économie','Marchés',2,
 'Un bien inférieur est un bien dont la demande :',
 '["Augmente quand le revenu augmente","Diminue quand le revenu augmente","Ne change pas avec le revenu","Augmente quand le prix augmente"]',
 1,'Un bien inférieur est délaissé au profit de biens de meilleure qualité quand le revenu augmente.'),

-- ── COMPTABILITÉ Série G1 ────────────────────────────────────

('BAC','G1','Comptabilité','Bilan',1,
 'L''actif du bilan comprend :',
 '["Les dettes","Les capitaux propres","Les emplois de l''entreprise","Les ressources extérieures"]',
 2,'L''actif représente les emplois (ce que l''entreprise possède), le passif représente les ressources.'),

('BAC','G1','Comptabilité','Compte de résultat',2,
 'Le résultat net est égal à :',
 '["Chiffre d''affaires − Charges","Produits − Charges","Actif − Passif","Capitaux propres"]',
 1,'Résultat = Produits − Charges. Si positif = bénéfice ; si négatif = perte.'),

('BAC','G1','Comptabilité','Opérations courantes',2,
 'Le principe de partie double en comptabilité signifie :',
 '["On enregistre chaque opération deux fois","Tout débit a une contrepartie de même montant au crédit","On tient deux livres comptables","On fait deux bilans par an"]',
 1,'Toute opération comptable donne lieu à un enregistrement au débit d''un compte et au crédit d''un autre, pour le même montant.'),

('BAC','G1','Comptabilité','Bilan',2,
 'Les amortissements sont enregistrés pour tenir compte :',
 '["De l''inflation","De la dépréciation des immobilisations dans le temps","Des dettes fournisseurs","De la TVA"]',
 1,'L''amortissement étale le coût d''une immobilisation sur sa durée de vie économique.'),

-- ── ANGLAIS (toutes séries) ──────────────────────────────────

('BAC',NULL,'Anglais','Grammar',2,
 '"If I _____ rich, I would travel the world." (Second conditional)',
 '["am","was","were","will be"]',
 2,'Le second conditionnel utilise "were" pour toutes les personnes : "If I were rich..."'),

('BAC',NULL,'Anglais','Grammar',2,
 'La voix passive de "They built this house in 1990" est :',
 '["This house builds in 1990","This house was built in 1990","This house has built in 1990","This house built in 1990"]',
 1,'La voix passive au prétérit : Subject + was/were + past participle. "This house was built in 1990."'),

('BAC',NULL,'Anglais','Vocabulary',1,
 'The synonym of "to purchase" is :',
 '["to sell","to buy","to rent","to borrow"]',
 1,'"To purchase" means "to buy" — acheter.'),

('BAC',NULL,'Anglais','Grammar',2,
 '"She has been working here _____ 2018."',
 '["since","for","during","while"]',
 0,'"Since" s''utilise avec un point dans le temps (2018). "For" s''utilise avec une durée.'),

('BAC',NULL,'Anglais','Grammar',3,
 '"By the time he arrives, we _____ dinner." (Future perfect)',
 '["will eat","have eaten","will have eaten","had eaten"]',
 2,'Le future perfect (will have + past participle) exprime une action complétée avant un moment futur.'),

('BAC',NULL,'Anglais','Reading',2,
 'In a text, the topic sentence usually appears :',
 '["At the end of the paragraph","In the middle of the paragraph","At the beginning of the paragraph","In a footnote"]',
 2,'La phrase topic (idée principale) se trouve généralement en début de paragraphe.'),

-- ── HISTOIRE-GÉOGRAPHIE (toutes séries) ──────────────────────

('BAC',NULL,'Histoire-Géographie','Histoire contemporaine',1,
 'La Première Guerre mondiale a débuté en :',
 '["1912","1914","1916","1918"]',
 1,'La Première Guerre mondiale a commencé le 28 juillet 1914 après l''assassinat de François-Ferdinand.'),

('BAC',NULL,'Histoire-Géographie','Histoire contemporaine',1,
 'L''Organisation des Nations Unies (ONU) a été créée en :',
 '["1939","1945","1948","1950"]',
 1,'L''ONU a été fondée le 24 octobre 1945, après la Seconde Guerre mondiale.'),

('BAC',NULL,'Histoire-Géographie','Géopolitique',2,
 'Le mouvement de décolonisation en Afrique s''est principalement développé durant :',
 '["Les années 1930","Les années 1950-1960","Les années 1970","Les années 1980"]',
 1,'La vague de décolonisation africaine est intervenue surtout entre 1955 et 1965, avec de nombreuses indépendances.'),

('BAC',NULL,'Histoire-Géographie','Géographie',2,
 'Le Cameroun est situé dans la zone :',
 '["Aride","Équatoriale et tropicale","Tempérée","Polaire"]',
 1,'Le Cameroun est qualifié d''"Afrique en miniature" car il couvre des zones équatoriales au Sud et semi-arides au Nord.')

ON CONFLICT DO NOTHING;
