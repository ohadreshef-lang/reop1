// ============================================================
// i18n — Hebrew (default), English, Spanish
// ============================================================

const SUPPORTED_LANGS = ['he', 'en', 'es'];
const RTL_LANGS       = ['he'];
const LANG_LABELS     = { he: 'עברית', en: 'English', es: 'Español' };

let currentLang = localStorage.getItem('wc2026_lang') || 'he';
if (!SUPPORTED_LANGS.includes(currentLang)) currentLang = 'he';

const TRANSLATIONS = {
    he: {
        // Common
        'common.save': 'שמור',
        'common.cancel': 'ביטול',
        'common.delete': 'מחק',
        'common.edit': 'ערוך',
        'common.loading': 'טוען...',
        'common.copy': 'העתק',
        'common.copied': 'הועתק ✓',
        'common.pts': 'נק\'',
        'common.close': 'סגור',
        'common.enter': 'כנס',
        'common.backToApp': 'חזרה לאפליקציה',

        // Login
        'login.title': 'ניחושי מונדיאל 2026',
        'login.subtitle': 'נחש תוצאות, צבור נקודות, תתחרה עם החברים!',
        'login.nameLabel': 'שם מלא',
        'login.namePlaceholder': 'הכנס את שמך...',
        'login.emailLabel': 'אימייל',
        'login.submit': 'כניסה / הרשמה',
        'login.hint': 'אם נרשמת בעבר עם אותו אימייל – תחזור לפרופיל שלך',
        'login.errorRequired': 'נא למלא שם ואימייל',

        // App bar
        'appBar.logout': 'יציאה',
        'appBar.noGroup': '—',

        // Group switcher
        'groupSwitch.createGroup': '➕ קבוצה חדשה',
        'groupSwitch.joinGroup': '🔗 הצטרף עם קוד',
        'groupSwitch.settings': '⚙️ הגדרות קבוצה',
        'groupSwitch.emptyMsg': 'עדיין לא הצטרפת לקבוצה',

        // Tabs
        'tabs.matches': 'משחקים',
        'tabs.leaderboard': 'לידרבורד',
        'tabs.myBets': 'הניחושים שלי',
        'tabs.tournament': 'טורניר',

        // Stages
        'stage.all': 'הכל',
        'stage.group': 'שלב הבתים',
        'stage.groupShort': 'בתים',
        'stage.R32': 'שלב 32',
        'stage.R16': 'שלב 16',
        'stage.QF': 'רבע גמר',
        'stage.SF': 'חצי גמר',
        'stage.3rd': 'מקום שלישי',
        'stage.Final': 'גמר',
        'stage.groupPrefix': 'בית',

        // Match card
        'match.status.upcoming': 'עתידי',
        'match.status.locked': 'נעול',
        'match.status.completed': 'הסתיים',
        'match.yourBet': 'ניחוש שלך',
        'match.lockedMsg': '🔒 נעול',
        'match.lockedNoBet': '🔒 לא ניחשת',
        'match.editBet': 'ערוך',
        'match.saveBet': '💾 שמור',
        'match.noBetRow': 'לא ניחשת על משחק זה',
        'match.pointsRow': 'ניחוש',
        'match.pointsLabel': 'נקודות',
        'match.emptyState': 'אין משחקים להצגה. האדמין יכול לטעון את המשחקים.',
        'match.loadingMatches': 'טוען משחקים...',

        // Leaderboard
        'leaderboard.title': '🏆 טבלת דירוג',
        'leaderboard.scoringExact': 'תוצאה מדויקת = 3 נק\'',
        'leaderboard.scoringWinner': 'מנצח נכון = 1 נק\'',
        'leaderboard.empty': 'אין משתתפים עדיין בקבוצה זו.',
        'leaderboard.meTag': 'אני',

        // My bets
        'myBets.title': '🎯 הניחושים שלי',
        'myBets.empty': 'עוד לא ניחשת על אף משחק.',
        'myBets.prediction': 'הניחוש שלי',
        'myBets.result': 'תוצאה',

        // Tournament
        'tournament.title': '🏆 ניחושי טורניר',
        'tournament.subtitle': '10 נקודות לכל ניחוש נכון. נסגר שעה לפני פתיחת הטורניר.',
        'tournament.lockSoon': 'נעילה בעוד:',
        'tournament.lockedBadge': '🔒 ניחושי הטורניר ננעלו',
        'tournament.champion': '🏆 אלופת המונדיאל',
        'tournament.topScorer': '⚽ מלך השערים',
        'tournament.selectPrompt': '— בחר —',
        'tournament.noBet': 'לא ניחשת',
        'tournament.yourBetPrefix': 'הניחוש שלך:',
        'tournament.resultChampion': 'האלופה:',
        'tournament.resultTopScorer': 'מלך השערים:',
        'tournament.pickNeeded': 'נא לבחור מועמד',
        'tournament.locked': 'הזמן לניחוש עבר',
        'tournament.emptyAdmin': 'האדמין עוד לא הגדיר מועמדים לניחושי הטורניר.',
        'tournament.needGroup': 'בחר קבוצה כדי לנחש',
        'tournament.days': 'ימים', 'tournament.hours': 'שעות', 'tournament.minutes': 'דקות', 'tournament.seconds': 'שניות',

        // Group picker
        'groupPicker.title': '⚽ מונדיאל 2026',
        'groupPicker.hello': 'שלום,',
        'groupPicker.subtitle': 'כדי להתחיל לנחש, הצטרף לקבוצה קיימת או צור חדשה',
        'groupPicker.createTitle': 'צור קבוצה חדשה',
        'groupPicker.createDesc': 'פתח קבוצה פרטית והזמן את החברים שלך עם קוד שיתוף',
        'groupPicker.createBtn': 'צור קבוצה',
        'groupPicker.joinTitle': 'הצטרף לקבוצה',
        'groupPicker.joinDesc': 'קיבלת קוד הזמנה מחבר? הכנס אותו כאן',
        'groupPicker.joinBtn': 'הצטרף עם קוד',

        // Create group
        'createGroup.title': 'צור קבוצה חדשה',
        'createGroup.subtitle': 'תן לקבוצה שם שיזהה אותה',
        'createGroup.nameLabel': 'שם הקבוצה',
        'createGroup.namePlaceholder': 'למשל: החברים של יוסי',
        'createGroup.success': 'הקבוצה נוצרה! שתף את הקוד עם החברים:',
        'createGroup.submit': 'צור קבוצה',
        'createGroup.errorName': 'נא להזין שם קבוצה',
        'createGroup.errorGeneric': 'שגיאה ביצירת הקבוצה',
        'createGroup.enter': 'כנס לקבוצה',

        // Join group
        'joinGroup.title': 'הצטרף לקבוצה',
        'joinGroup.subtitle': 'הכנס את קוד ההזמנה שקיבלת (6 תווים)',
        'joinGroup.codeLabel': 'קוד הזמנה',
        'joinGroup.submit': 'הצטרף',
        'joinGroup.errorLength': 'קוד הזמנה חייב להיות בן 6 תווים',
        'joinGroup.errorInvalid': 'קוד הזמנה לא תקין',
        'joinGroup.errorGeneric': 'שגיאה בהצטרפות לקבוצה',

        // Group settings
        'groupSettings.title': 'הגדרות קבוצה',
        'groupSettings.nameLabel': 'שם הקבוצה',
        'groupSettings.saveName': 'שמור שם',
        'groupSettings.inviteLabel': 'קוד הזמנה',
        'groupSettings.membersLabel': 'חברי הקבוצה',
        'groupSettings.leave': 'עזוב קבוצה',
        'groupSettings.delete': 'מחק קבוצה',
        'groupSettings.ownerBadge': 'מנהל',
        'groupSettings.kick': 'הסר',
        'groupSettings.savedOk': 'השם נשמר ✓',
        'groupSettings.errorEmpty': 'נא להזין שם',
        'groupSettings.kickConfirm': 'להסיר את החבר מהקבוצה?',
        'groupSettings.leaveOwner': 'מנהל הקבוצה אינו יכול לעזוב — מחק את הקבוצה במקום זאת.',
        'groupSettings.leaveConfirm': 'לעזוב את הקבוצה?',
        'groupSettings.deleteConfirm': (name) => `למחוק את הקבוצה "${name}" לצמיתות? כל הניחושים של חבריה יאבדו.`,
        'groupSettings.unknownUser': 'משתמש',

        // Admin
        'admin.title': '🔧 פאנל אדמין',
        'admin.passwordTitle': 'כניסת מנהל',
        'admin.passwordLabel': 'סיסמת מנהל',
        'admin.passwordPlaceholder': 'סיסמה...',
        'admin.passwordWrong': 'סיסמה שגויה',
        'admin.login': 'כניסה',
        'admin.passwordHint': 'סיסמה ברירת מחדל: admin2026',

        'admin.addMatchTitle': '➕ הוסף משחק',
        'admin.team1Placeholder': 'קבוצה 1 (למשל: ברזיל)',
        'admin.team2Placeholder': 'קבוצה 2 (למשל: ארגנטינה)',
        'admin.groupLabelPlaceholder': 'בית (A–L, לשלב הבתים)',
        'admin.addMatchBtn': 'הוסף משחק',
        'admin.seedBtn': '⚡ טען משחקי מונדיאל 2026',
        'admin.addMatchMissing': 'נא למלא קבוצה 1, קבוצה 2 ותאריך',

        'admin.changePwdTitle': '🔑 שנה סיסמה',
        'admin.newPwdPlaceholder': 'סיסמה חדשה',
        'admin.pwdTooShort': 'סיסמה חייבת להכיל לפחות 4 תווים',
        'admin.pwdSaved': 'הסיסמה שונתה בהצלחה!',

        'admin.matchesTitle': '📋 ניהול משחקים',
        'admin.usersTitle': '👥 ניהול משתמשים',
        'admin.noMatches': 'אין משחקים עדיין.',
        'admin.noUsers': 'אין משתמשים רשומים.',
        'admin.enterResult': 'הזן תוצאה',
        'admin.deleteMatchConfirm': 'למחוק משחק זה?',
        'admin.groupsCount': 'קבוצות',
        'admin.userEditName': 'ערוך שם',
        'admin.deleteUserConfirm': (name) => `למחוק את המשתמש "${name}" וכל הניחושים שלו מכל הקבוצות?`,
        'admin.saveMissing': 'נא למלא שדות חובה',
        'admin.resultSaved': 'תוצאה נשמרה! הנקודות חושבו מחדש.',
        'admin.editUserEmpty': 'נא להזין שם',

        'admin.tournamentTitle': '🏆 ניחושי טורניר',
        'admin.tournamentHint1': 'רשימות המועמדים לאלופה ולמלך השערים. שורה = מועמד. המשתמשים יוכלו לבחור מהרשימות.',
        'admin.tournamentHint2': 'תוצאות סופיות (הזן רק בתום הטורניר — מחשב 10 נק\' לכל ניחוש נכון בכל קבוצה):',
        'admin.teamsLabel': 'מועמדות לאליפות',
        'admin.scorersLabel': 'מועמדים למלך השערים',
        'admin.saveList': 'שמור רשימה',
        'admin.finalWinnerPlaceholder': '— אלופה —',
        'admin.finalScorerPlaceholder': '— מלך השערים —',
        'admin.saveTournamentResult': 'שמור תוצאה ↦ חשב נקודות',
        'admin.tournamentTeamsSaved': 'רשימת מועמדות לאליפות נשמרה',
        'admin.tournamentScorersSaved': 'רשימת מלך השערים נשמרה',
        'admin.tournamentNeedsPick': 'יש לבחור לפחות אחד',
        'admin.tournamentSaveConfirm': 'לשמור את התוצאה ולחשב נקודות לכל הקבוצות?',
        'admin.tournamentSaved': 'תוצאת הטורניר נשמרה. הנקודות חושבו בכל הקבוצות.',

        // Modals
        'modal.enterResultTitle': 'הזן תוצאת משחק',
        'modal.editMatchTitle': 'ערוך משחק',
        'modal.editUserTitle': 'ערוך משתמש',
        'modal.saveAndRecalc': 'שמור ↦ חשב נקודות',
        'modal.saveChanges': 'שמור שינויים',
    },

    en: {
        'common.save': 'Save',
        'common.cancel': 'Cancel',
        'common.delete': 'Delete',
        'common.edit': 'Edit',
        'common.loading': 'Loading...',
        'common.copy': 'Copy',
        'common.copied': 'Copied ✓',
        'common.pts': 'pts',
        'common.close': 'Close',
        'common.enter': 'Enter',
        'common.backToApp': 'Back to app',

        'login.title': 'World Cup 2026 Predictions',
        'login.subtitle': 'Predict scores, earn points, compete with friends!',
        'login.nameLabel': 'Full name',
        'login.namePlaceholder': 'Your name...',
        'login.emailLabel': 'Email',
        'login.submit': 'Log in / Sign up',
        'login.hint': 'If you registered before with the same email, you\'ll be taken back to your profile',
        'login.errorRequired': 'Please enter name and email',

        'appBar.logout': 'Log out',
        'appBar.noGroup': '—',

        'groupSwitch.createGroup': '➕ New group',
        'groupSwitch.joinGroup': '🔗 Join with code',
        'groupSwitch.settings': '⚙️ Group settings',
        'groupSwitch.emptyMsg': 'You haven\'t joined any group yet',

        'tabs.matches': 'Matches',
        'tabs.leaderboard': 'Leaderboard',
        'tabs.myBets': 'My predictions',
        'tabs.tournament': 'Tournament',

        'stage.all': 'All',
        'stage.group': 'Group stage',
        'stage.groupShort': 'Groups',
        'stage.R32': 'Round of 32',
        'stage.R16': 'Round of 16',
        'stage.QF': 'Quarter-final',
        'stage.SF': 'Semi-final',
        'stage.3rd': '3rd place',
        'stage.Final': 'Final',
        'stage.groupPrefix': 'Group',

        'match.status.upcoming': 'Upcoming',
        'match.status.locked': 'Locked',
        'match.status.completed': 'Finished',
        'match.yourBet': 'Your prediction',
        'match.lockedMsg': '🔒 Locked',
        'match.lockedNoBet': '🔒 No prediction',
        'match.editBet': 'Edit',
        'match.saveBet': '💾 Save',
        'match.noBetRow': 'You didn\'t predict this match',
        'match.pointsRow': 'Prediction',
        'match.pointsLabel': 'points',
        'match.emptyState': 'No matches to display. An admin can load them.',
        'match.loadingMatches': 'Loading matches...',

        'leaderboard.title': '🏆 Leaderboard',
        'leaderboard.scoringExact': 'Exact score = 3 pts',
        'leaderboard.scoringWinner': 'Correct winner = 1 pt',
        'leaderboard.empty': 'No members in this group yet.',
        'leaderboard.meTag': 'you',

        'myBets.title': '🎯 My predictions',
        'myBets.empty': 'You haven\'t predicted any match yet.',
        'myBets.prediction': 'My prediction',
        'myBets.result': 'Result',

        'tournament.title': '🏆 Tournament predictions',
        'tournament.subtitle': '10 points per correct prediction. Locks 1 hour before the tournament starts.',
        'tournament.lockSoon': 'Locks in:',
        'tournament.lockedBadge': '🔒 Tournament predictions are locked',
        'tournament.champion': '🏆 World Cup champion',
        'tournament.topScorer': '⚽ Top scorer',
        'tournament.selectPrompt': '— Select —',
        'tournament.noBet': 'No prediction',
        'tournament.yourBetPrefix': 'Your prediction:',
        'tournament.resultChampion': 'Champion:',
        'tournament.resultTopScorer': 'Top scorer:',
        'tournament.pickNeeded': 'Please pick a candidate',
        'tournament.locked': 'Prediction window closed',
        'tournament.emptyAdmin': 'Admin hasn\'t set up tournament candidates yet.',
        'tournament.needGroup': 'Pick a group to predict',
        'tournament.days': 'days', 'tournament.hours': 'hours', 'tournament.minutes': 'minutes', 'tournament.seconds': 'seconds',

        'groupPicker.title': '⚽ World Cup 2026',
        'groupPicker.hello': 'Hi,',
        'groupPicker.subtitle': 'To start predicting, join an existing group or create a new one',
        'groupPicker.createTitle': 'Create new group',
        'groupPicker.createDesc': 'Start a private group and invite friends with a share code',
        'groupPicker.createBtn': 'Create group',
        'groupPicker.joinTitle': 'Join a group',
        'groupPicker.joinDesc': 'Got an invite code from a friend? Enter it here',
        'groupPicker.joinBtn': 'Join with code',

        'createGroup.title': 'Create new group',
        'createGroup.subtitle': 'Give the group a name to identify it',
        'createGroup.nameLabel': 'Group name',
        'createGroup.namePlaceholder': 'e.g. Yossi\'s friends',
        'createGroup.success': 'Group created! Share the code with your friends:',
        'createGroup.submit': 'Create group',
        'createGroup.errorName': 'Please enter a group name',
        'createGroup.errorGeneric': 'Error creating group',
        'createGroup.enter': 'Enter group',

        'joinGroup.title': 'Join a group',
        'joinGroup.subtitle': 'Enter the invite code you received (6 chars)',
        'joinGroup.codeLabel': 'Invite code',
        'joinGroup.submit': 'Join',
        'joinGroup.errorLength': 'Invite code must be 6 chars',
        'joinGroup.errorInvalid': 'Invalid invite code',
        'joinGroup.errorGeneric': 'Error joining group',

        'groupSettings.title': 'Group settings',
        'groupSettings.nameLabel': 'Group name',
        'groupSettings.saveName': 'Save name',
        'groupSettings.inviteLabel': 'Invite code',
        'groupSettings.membersLabel': 'Members',
        'groupSettings.leave': 'Leave group',
        'groupSettings.delete': 'Delete group',
        'groupSettings.ownerBadge': 'owner',
        'groupSettings.kick': 'Remove',
        'groupSettings.savedOk': 'Name saved ✓',
        'groupSettings.errorEmpty': 'Please enter a name',
        'groupSettings.kickConfirm': 'Remove this member from the group?',
        'groupSettings.leaveOwner': 'The owner cannot leave — delete the group instead.',
        'groupSettings.leaveConfirm': 'Leave the group?',
        'groupSettings.deleteConfirm': (name) => `Delete the group "${name}" permanently? All members\' predictions will be lost.`,
        'groupSettings.unknownUser': 'User',

        'admin.title': '🔧 Admin panel',
        'admin.passwordTitle': 'Admin login',
        'admin.passwordLabel': 'Admin password',
        'admin.passwordPlaceholder': 'Password...',
        'admin.passwordWrong': 'Wrong password',
        'admin.login': 'Log in',
        'admin.passwordHint': 'Default password: admin2026',

        'admin.addMatchTitle': '➕ Add match',
        'admin.team1Placeholder': 'Team 1 (e.g. Brazil)',
        'admin.team2Placeholder': 'Team 2 (e.g. Argentina)',
        'admin.groupLabelPlaceholder': 'Group (A–L, for group stage)',
        'admin.addMatchBtn': 'Add match',
        'admin.seedBtn': '⚡ Load World Cup 2026 matches',
        'admin.addMatchMissing': 'Please fill team 1, team 2, and date',

        'admin.changePwdTitle': '🔑 Change password',
        'admin.newPwdPlaceholder': 'New password',
        'admin.pwdTooShort': 'Password must be at least 4 chars',
        'admin.pwdSaved': 'Password changed!',

        'admin.matchesTitle': '📋 Matches',
        'admin.usersTitle': '👥 Users',
        'admin.noMatches': 'No matches yet.',
        'admin.noUsers': 'No users registered.',
        'admin.enterResult': 'Enter result',
        'admin.deleteMatchConfirm': 'Delete this match?',
        'admin.groupsCount': 'groups',
        'admin.userEditName': 'Edit name',
        'admin.deleteUserConfirm': (name) => `Delete user "${name}" and all their predictions across all groups?`,
        'admin.saveMissing': 'Please fill required fields',
        'admin.resultSaved': 'Result saved! Points recalculated.',
        'admin.editUserEmpty': 'Please enter a name',

        'admin.tournamentTitle': '🏆 Tournament predictions',
        'admin.tournamentHint1': 'Champion and top-scorer candidate lists. One per line. Members pick from these.',
        'admin.tournamentHint2': 'Final results (enter only when tournament ends — awards 10 pts per correct prediction in each group):',
        'admin.teamsLabel': 'Champion candidates',
        'admin.scorersLabel': 'Top-scorer candidates',
        'admin.saveList': 'Save list',
        'admin.finalWinnerPlaceholder': '— Champion —',
        'admin.finalScorerPlaceholder': '— Top scorer —',
        'admin.saveTournamentResult': 'Save result ↦ recalculate',
        'admin.tournamentTeamsSaved': 'Champion candidate list saved',
        'admin.tournamentScorersSaved': 'Top-scorer candidate list saved',
        'admin.tournamentNeedsPick': 'Pick at least one',
        'admin.tournamentSaveConfirm': 'Save result and recalculate points for all groups?',
        'admin.tournamentSaved': 'Tournament result saved. Points recalculated across all groups.',

        'modal.enterResultTitle': 'Enter match result',
        'modal.editMatchTitle': 'Edit match',
        'modal.editUserTitle': 'Edit user',
        'modal.saveAndRecalc': 'Save ↦ recalculate',
        'modal.saveChanges': 'Save changes',
    },

    es: {
        'common.save': 'Guardar',
        'common.cancel': 'Cancelar',
        'common.delete': 'Eliminar',
        'common.edit': 'Editar',
        'common.loading': 'Cargando...',
        'common.copy': 'Copiar',
        'common.copied': 'Copiado ✓',
        'common.pts': 'pts',
        'common.close': 'Cerrar',
        'common.enter': 'Entrar',
        'common.backToApp': 'Volver a la app',

        'login.title': 'Predicciones Mundial 2026',
        'login.subtitle': '¡Predice resultados, suma puntos, compite con amigos!',
        'login.nameLabel': 'Nombre completo',
        'login.namePlaceholder': 'Tu nombre...',
        'login.emailLabel': 'Email',
        'login.submit': 'Entrar / Registrarse',
        'login.hint': 'Si ya te registraste con el mismo email, volverás a tu perfil',
        'login.errorRequired': 'Por favor ingresa nombre y email',

        'appBar.logout': 'Salir',
        'appBar.noGroup': '—',

        'groupSwitch.createGroup': '➕ Nuevo grupo',
        'groupSwitch.joinGroup': '🔗 Unirse con código',
        'groupSwitch.settings': '⚙️ Ajustes del grupo',
        'groupSwitch.emptyMsg': 'Aún no te uniste a ningún grupo',

        'tabs.matches': 'Partidos',
        'tabs.leaderboard': 'Tabla',
        'tabs.myBets': 'Mis predicciones',
        'tabs.tournament': 'Torneo',

        'stage.all': 'Todos',
        'stage.group': 'Fase de grupos',
        'stage.groupShort': 'Grupos',
        'stage.R32': 'Dieciseisavos',
        'stage.R16': 'Octavos',
        'stage.QF': 'Cuartos',
        'stage.SF': 'Semifinal',
        'stage.3rd': 'Tercer puesto',
        'stage.Final': 'Final',
        'stage.groupPrefix': 'Grupo',

        'match.status.upcoming': 'Próximo',
        'match.status.locked': 'Bloqueado',
        'match.status.completed': 'Finalizado',
        'match.yourBet': 'Tu predicción',
        'match.lockedMsg': '🔒 Bloqueado',
        'match.lockedNoBet': '🔒 Sin predicción',
        'match.editBet': 'Editar',
        'match.saveBet': '💾 Guardar',
        'match.noBetRow': 'No predijiste este partido',
        'match.pointsRow': 'Predicción',
        'match.pointsLabel': 'puntos',
        'match.emptyState': 'No hay partidos. Un admin puede cargarlos.',
        'match.loadingMatches': 'Cargando partidos...',

        'leaderboard.title': '🏆 Tabla de posiciones',
        'leaderboard.scoringExact': 'Resultado exacto = 3 pts',
        'leaderboard.scoringWinner': 'Ganador correcto = 1 pt',
        'leaderboard.empty': 'Aún no hay miembros en este grupo.',
        'leaderboard.meTag': 'tú',

        'myBets.title': '🎯 Mis predicciones',
        'myBets.empty': 'Aún no predijiste ningún partido.',
        'myBets.prediction': 'Mi predicción',
        'myBets.result': 'Resultado',

        'tournament.title': '🏆 Predicciones del torneo',
        'tournament.subtitle': '10 puntos por predicción correcta. Se cierra 1 hora antes del inicio del torneo.',
        'tournament.lockSoon': 'Se cierra en:',
        'tournament.lockedBadge': '🔒 Predicciones del torneo cerradas',
        'tournament.champion': '🏆 Campeón del Mundial',
        'tournament.topScorer': '⚽ Goleador',
        'tournament.selectPrompt': '— Elegir —',
        'tournament.noBet': 'Sin predicción',
        'tournament.yourBetPrefix': 'Tu predicción:',
        'tournament.resultChampion': 'Campeón:',
        'tournament.resultTopScorer': 'Goleador:',
        'tournament.pickNeeded': 'Elige un candidato',
        'tournament.locked': 'Ventana de predicciones cerrada',
        'tournament.emptyAdmin': 'El admin todavía no configuró candidatos.',
        'tournament.needGroup': 'Elige un grupo para predecir',
        'tournament.days': 'días', 'tournament.hours': 'horas', 'tournament.minutes': 'minutos', 'tournament.seconds': 'segundos',

        'groupPicker.title': '⚽ Mundial 2026',
        'groupPicker.hello': 'Hola,',
        'groupPicker.subtitle': 'Para empezar, únete a un grupo existente o crea uno nuevo',
        'groupPicker.createTitle': 'Crear nuevo grupo',
        'groupPicker.createDesc': 'Abre un grupo privado e invita a tus amigos con un código',
        'groupPicker.createBtn': 'Crear grupo',
        'groupPicker.joinTitle': 'Unirse a un grupo',
        'groupPicker.joinDesc': '¿Recibiste un código de invitación? Ingrésalo aquí',
        'groupPicker.joinBtn': 'Unirse con código',

        'createGroup.title': 'Crear nuevo grupo',
        'createGroup.subtitle': 'Dale un nombre al grupo',
        'createGroup.nameLabel': 'Nombre del grupo',
        'createGroup.namePlaceholder': 'ej. Los amigos de Juan',
        'createGroup.success': '¡Grupo creado! Comparte el código con tus amigos:',
        'createGroup.submit': 'Crear grupo',
        'createGroup.errorName': 'Ingresa un nombre',
        'createGroup.errorGeneric': 'Error al crear el grupo',
        'createGroup.enter': 'Entrar al grupo',

        'joinGroup.title': 'Unirse a un grupo',
        'joinGroup.subtitle': 'Ingresa el código de invitación (6 caracteres)',
        'joinGroup.codeLabel': 'Código de invitación',
        'joinGroup.submit': 'Unirse',
        'joinGroup.errorLength': 'El código debe tener 6 caracteres',
        'joinGroup.errorInvalid': 'Código inválido',
        'joinGroup.errorGeneric': 'Error al unirse',

        'groupSettings.title': 'Ajustes del grupo',
        'groupSettings.nameLabel': 'Nombre del grupo',
        'groupSettings.saveName': 'Guardar nombre',
        'groupSettings.inviteLabel': 'Código de invitación',
        'groupSettings.membersLabel': 'Miembros',
        'groupSettings.leave': 'Salir del grupo',
        'groupSettings.delete': 'Eliminar grupo',
        'groupSettings.ownerBadge': 'dueño',
        'groupSettings.kick': 'Expulsar',
        'groupSettings.savedOk': 'Nombre guardado ✓',
        'groupSettings.errorEmpty': 'Ingresa un nombre',
        'groupSettings.kickConfirm': '¿Expulsar a este miembro del grupo?',
        'groupSettings.leaveOwner': 'El dueño no puede salir — elimina el grupo en su lugar.',
        'groupSettings.leaveConfirm': '¿Salir del grupo?',
        'groupSettings.deleteConfirm': (name) => `¿Eliminar el grupo "${name}" permanentemente? Se perderán todas las predicciones.`,
        'groupSettings.unknownUser': 'Usuario',

        'admin.title': '🔧 Panel de admin',
        'admin.passwordTitle': 'Acceso admin',
        'admin.passwordLabel': 'Contraseña admin',
        'admin.passwordPlaceholder': 'Contraseña...',
        'admin.passwordWrong': 'Contraseña incorrecta',
        'admin.login': 'Entrar',
        'admin.passwordHint': 'Contraseña por defecto: admin2026',

        'admin.addMatchTitle': '➕ Agregar partido',
        'admin.team1Placeholder': 'Equipo 1 (ej. Brasil)',
        'admin.team2Placeholder': 'Equipo 2 (ej. Argentina)',
        'admin.groupLabelPlaceholder': 'Grupo (A–L, fase de grupos)',
        'admin.addMatchBtn': 'Agregar partido',
        'admin.seedBtn': '⚡ Cargar partidos Mundial 2026',
        'admin.addMatchMissing': 'Completa equipo 1, equipo 2 y fecha',

        'admin.changePwdTitle': '🔑 Cambiar contraseña',
        'admin.newPwdPlaceholder': 'Nueva contraseña',
        'admin.pwdTooShort': 'Mínimo 4 caracteres',
        'admin.pwdSaved': '¡Contraseña cambiada!',

        'admin.matchesTitle': '📋 Partidos',
        'admin.usersTitle': '👥 Usuarios',
        'admin.noMatches': 'Aún no hay partidos.',
        'admin.noUsers': 'No hay usuarios registrados.',
        'admin.enterResult': 'Ingresar resultado',
        'admin.deleteMatchConfirm': '¿Eliminar este partido?',
        'admin.groupsCount': 'grupos',
        'admin.userEditName': 'Editar nombre',
        'admin.deleteUserConfirm': (name) => `¿Eliminar al usuario "${name}" y todas sus predicciones de todos los grupos?`,
        'admin.saveMissing': 'Completa los campos requeridos',
        'admin.resultSaved': '¡Resultado guardado! Puntos recalculados.',
        'admin.editUserEmpty': 'Ingresa un nombre',

        'admin.tournamentTitle': '🏆 Predicciones del torneo',
        'admin.tournamentHint1': 'Listas de candidatos a campeón y goleador. Uno por línea.',
        'admin.tournamentHint2': 'Resultados finales (solo al terminar el torneo — otorga 10 pts por predicción correcta en cada grupo):',
        'admin.teamsLabel': 'Candidatos a campeón',
        'admin.scorersLabel': 'Candidatos a goleador',
        'admin.saveList': 'Guardar lista',
        'admin.finalWinnerPlaceholder': '— Campeón —',
        'admin.finalScorerPlaceholder': '— Goleador —',
        'admin.saveTournamentResult': 'Guardar resultado ↦ recalcular',
        'admin.tournamentTeamsSaved': 'Lista de candidatos a campeón guardada',
        'admin.tournamentScorersSaved': 'Lista de candidatos a goleador guardada',
        'admin.tournamentNeedsPick': 'Elige al menos uno',
        'admin.tournamentSaveConfirm': '¿Guardar resultado y recalcular puntos de todos los grupos?',
        'admin.tournamentSaved': 'Resultado del torneo guardado. Puntos recalculados.',

        'modal.enterResultTitle': 'Ingresar resultado',
        'modal.editMatchTitle': 'Editar partido',
        'modal.editUserTitle': 'Editar usuario',
        'modal.saveAndRecalc': 'Guardar ↦ recalcular',
        'modal.saveChanges': 'Guardar cambios',
    },
};

// Team name translations (keyed by the Hebrew name stored in the DB)
const TEAM_TRANSLATIONS = {
    en: {
        'ארצות הברית':'USA','קנדה':'Canada','מקסיקו':'Mexico',
        'ברזיל':'Brazil','ארגנטינה':'Argentina','אורוגוואי':'Uruguay',
        'קולומביה':'Colombia','אקוודור':'Ecuador','ונצואלה':'Venezuela',
        'פרגוואי':'Paraguay','בוליביה':'Bolivia','צ\'ילה':'Chile',
        'צרפת':'France','ספרד':'Spain','גרמניה':'Germany',
        'אנגליה':'England','פורטוגל':'Portugal','הולנד':'Netherlands',
        'איטליה':'Italy','בלגיה':'Belgium','שווייץ':'Switzerland',
        'קרואטיה':'Croatia','סרביה':'Serbia','דנמרק':'Denmark',
        'אוסטריה':'Austria','סקוטלנד':'Scotland','טורקיה':'Turkey',
        'רומניה':'Romania','הונגריה':'Hungary','פולין':'Poland',
        'מרוקו':'Morocco','סנגל':'Senegal','ניגריה':'Nigeria',
        'מצרים':'Egypt','קמרון':'Cameroon','חוף השנהב':'Ivory Coast',
        'אלג\'יריה':'Algeria','תוניסיה':'Tunisia','דרום אפריקה':'South Africa',
        'יפן':'Japan','קוריאה הדרומית':'South Korea','איראן':'Iran',
        'ערב הסעודית':'Saudi Arabia','אוסטרליה':'Australia','עיראק':'Iraq',
        'ירדן':'Jordan','אוזבקיסטן':'Uzbekistan','ניו זילנד':'New Zealand',
        'הונדורס':'Honduras','פנמה':'Panama','קוסטה ריקה':'Costa Rica',
        'צ\'כיה':'Czechia','קטאר':'Qatar','בוסניה והרצגובינה':'Bosnia and Herzegovina',
        'האיטי':'Haiti','קוראסאו':'Curaçao','שוודיה':'Sweden',
        'קאבו ורדה':'Cape Verde','נורווגיה':'Norway','קונגו DR':'DR Congo','גאנה':'Ghana',
    },
    es: {
        'ארצות הברית':'EE.UU.','קנדה':'Canadá','מקסיקו':'México',
        'ברזיל':'Brasil','ארגנטינה':'Argentina','אורוגוואי':'Uruguay',
        'קולומביה':'Colombia','אקוודור':'Ecuador','ונצואלה':'Venezuela',
        'פרגוואי':'Paraguay','בוליביה':'Bolivia','צ\'ילה':'Chile',
        'צרפת':'Francia','ספרד':'España','גרמניה':'Alemania',
        'אנגליה':'Inglaterra','פורטוגל':'Portugal','הולנד':'Países Bajos',
        'איטליה':'Italia','בלגיה':'Bélgica','שווייץ':'Suiza',
        'קרואטיה':'Croacia','סרביה':'Serbia','דנמרק':'Dinamarca',
        'אוסטריה':'Austria','סקוטלנד':'Escocia','טורקיה':'Turquía',
        'רומניה':'Rumania','הונגריה':'Hungría','פולין':'Polonia',
        'מרוקו':'Marruecos','סנגל':'Senegal','ניגריה':'Nigeria',
        'מצרים':'Egipto','קמרון':'Camerún','חוף השנהב':'Costa de Marfil',
        'אלג\'יריה':'Argelia','תוניסיה':'Túnez','דרום אפריקה':'Sudáfrica',
        'יפן':'Japón','קוריאה הדרומית':'Corea del Sur','איראן':'Irán',
        'ערב הסעודית':'Arabia Saudita','אוסטרליה':'Australia','עיראק':'Irak',
        'ירדן':'Jordania','אוזבקיסטן':'Uzbekistán','ניו זילנד':'Nueva Zelanda',
        'הונדורס':'Honduras','פנמה':'Panamá','קוסטה ריקה':'Costa Rica',
        'צ\'כיה':'Chequia','קטאר':'Catar','בוסניה והרצגובינה':'Bosnia y Herzegovina',
        'האיטי':'Haití','קוראסאו':'Curazao','שוודיה':'Suecia',
        'קאבו ורדה':'Cabo Verde','נורווגיה':'Noruega','קונגו DR':'RD Congo','גאנה':'Ghana',
    },
};

function t(key, ...args) {
    const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.he;
    const val = dict[key] !== undefined ? dict[key] : (TRANSLATIONS.he[key] !== undefined ? TRANSLATIONS.he[key] : key);
    return typeof val === 'function' ? val(...args) : val;
}

function translateTeam(name) {
    if (!name || currentLang === 'he') return name || '';
    const dict = TEAM_TRANSLATIONS[currentLang];
    return (dict && dict[name]) || name;
}

function applyTranslations() {
    document.documentElement.lang = currentLang;
    document.documentElement.dir  = RTL_LANGS.includes(currentLang) ? 'rtl' : 'ltr';
    document.body.classList.toggle('lang-rtl', RTL_LANGS.includes(currentLang));
    document.body.classList.toggle('lang-ltr', !RTL_LANGS.includes(currentLang));

    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });

    // Page title
    document.title = t('login.title');

    // Re-render whatever is currently shown
    if (typeof renderCurrentTab === 'function' && typeof activeTab !== 'undefined' && activeTab) {
        try { renderCurrentTab(); } catch(e) {}
    }
    if (typeof renderGroupSwitcher === 'function') {
        try { renderGroupSwitcher(); } catch(e) {}
    }
    if (typeof renderAdminMatches === 'function' && document.getElementById('admin-content') && document.getElementById('admin-content').style.display !== 'none') {
        try {
            const matchesEl = document.getElementById('admin-matches-container');
            if (matchesEl && !matchesEl.querySelector('.state-msg')) loadAdminMatches();
            loadAdminUsers();
            loadAdminTournament();
        } catch(e) {}
    }
}

function setLanguage(lang) {
    if (!SUPPORTED_LANGS.includes(lang)) return;
    currentLang = lang;
    localStorage.setItem('wc2026_lang', lang);
    applyTranslations();
    renderLangToggle();
}

function renderLangToggle() {
    document.querySelectorAll('.lang-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === currentLang);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    applyTranslations();
    renderLangToggle();
    document.querySelectorAll('.lang-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
    });
});
