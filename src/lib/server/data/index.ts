import { env } from '$env/dynamic/private';
import * as supabase from './supabase';

/** true bila terhubung ke MySQL Remote. */
export const isMysql = Boolean(env.MYSQL_HOST || process.env.MYSQL_HOST);

/** true bila terhubung ke Supabase (URL + service role key tersedia di env dan bukan MySQL). */
export const isSupabase = !isMysql && Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

type SupabaseType = typeof supabase;

// Dynamic wrapper: delegasi ke mysql / supabase jika aktif, atau ke sqlite secara lazy jika lokal.
let _sqliteModule: any = null;
let _mysqlModule: any = null;

async function getDbModule() {
	if (isMysql) {
		if (!_mysqlModule) {
			_mysqlModule = await import('./mysql');
		}
		return _mysqlModule;
	}
	if (!_sqliteModule) {
		_sqliteModule = await import('./sqlite');
	}
	return _sqliteModule;
}

function proxy<K extends keyof SupabaseType>(key: K): SupabaseType[K] {
	return (async (...args: any[]) => {
		if (isSupabase) {
			return (supabase[key] as any)(...args);
		}
		const mod = await getDbModule();
		return mod[key](...args);
	}) as unknown as SupabaseType[K];
}

export const authFindUserByEmail = proxy('authFindUserByEmail');
export const authFindUserByIdentifier = proxy('authFindUserByIdentifier');
export const authGetUserById = proxy('authGetUserById');
export const authGetSession = proxy('authGetSession');
export const authCreateSession = proxy('authCreateSession');
export const authDeleteSession = proxy('authDeleteSession');
export const authUpsertByAuthId = proxy('authUpsertByAuthId');
export const authUpdatePasswordHash = proxy('authUpdatePasswordHash');
export const authGetAuthId = proxy('authGetAuthId');
export const authSetProfile = proxy('authSetProfile');

export const findUserByTeacherId = proxy('findUserByTeacherId');
export const createUserAccount = proxy('createUserAccount');
export const updateUserAccount = proxy('updateUserAccount');

export const getSchool = proxy('getSchool');
export const updateSchool = proxy('updateSchool');
export const getSetting = proxy('getSetting');

export const getClasses = proxy('getClasses');
export const getClass = proxy('getClass');
export const createClass = proxy('createClass');
export const updateClass = proxy('updateClass');
export const deleteClass = proxy('deleteClass');

export const getTeachers = proxy('getTeachers');
export const createTeacher = proxy('createTeacher');
export const updateTeacher = proxy('updateTeacher');
export const deleteTeacher = proxy('deleteTeacher');

export const getSubjects = proxy('getSubjects');
export const getTeacherSubjects = proxy('getTeacherSubjects');
export const getClassesForTeacher = proxy('getClassesForTeacher');
export const getSubjectsForClass = proxy('getSubjectsForClass');
export const createSubject = proxy('createSubject');
export const updateSubject = proxy('updateSubject');
export const deleteSubject = proxy('deleteSubject');

export const getStudents = proxy('getStudents');
export const getStudent = proxy('getStudent');
export const createStudent = proxy('createStudent');
export const updateStudent = proxy('updateStudent');
export const deleteStudent = proxy('deleteStudent');
export const importStudents = proxy('importStudents');

export const isHoliday = proxy('isHoliday');
export const getAttendanceByDate = proxy('getAttendanceByDate');
export const upsertAttendance = proxy('upsertAttendance');
export const getAttendanceHistory = proxy('getAttendanceHistory');
export const getAttendanceLogs = proxy('getAttendanceLogs');

export const getAttendanceSubjectByDate = proxy('getAttendanceSubjectByDate');
export const upsertSubjectAttendance = proxy('upsertSubjectAttendance');

export const getJournals = proxy('getJournals');
export const createJournal = proxy('createJournal');
export const updateJournal = proxy('updateJournal');
export const deleteJournal = proxy('deleteJournal');

export const getHolidays = proxy('getHolidays');
export const getUpcomingHolidays = proxy('getUpcomingHolidays');
export const upsertHoliday = proxy('upsertHoliday');
export const deleteHoliday = proxy('deleteHoliday');

export const getReportSummary = proxy('getReportSummary');
export const getAttendanceMatrix = proxy('getAttendanceMatrix');
export const getSubjectAttendanceMatrix = proxy('getSubjectAttendanceMatrix');
export const getAlerts = proxy('getAlerts');
export const getDashboard = proxy('getDashboard');

export const getAcademicPeriods = proxy('getAcademicPeriods');
export const addAcademicPeriod = proxy('addAcademicPeriod');
export const setActivePeriod = proxy('setActivePeriod');
