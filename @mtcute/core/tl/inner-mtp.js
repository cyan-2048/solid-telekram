// This file is auto-generated. Do not edit.
function _isAny() { const a = arguments; return function(o) { if (typeof o !== 'object' || o === null) return false; for (let i = 0; i < a.length; i++) if (o._ === a[i]) return true; return false } }
export const LAYER = 0;
export const isAnyResPQ = /*#__PURE__*/ _isAny('mt_resPQ', 'mt_req_pq_multi');
export const isAnyP_Q_inner_data = /*#__PURE__*/ _isAny('mt_p_q_inner_data_dc', 'mt_p_q_inner_data_temp_dc');
export const isAnyServer_DH_Params = /*#__PURE__*/ _isAny('mt_server_DH_params_ok', 'mt_req_DH_params');
export const isAnyServer_DH_inner_data = /*#__PURE__*/ _isAny('mt_server_DH_inner_data');
export const isAnyClient_DH_Inner_Data = /*#__PURE__*/ _isAny('mt_client_DH_inner_data');
export const isAnySet_client_DH_params_answer = /*#__PURE__*/ _isAny('mt_dh_gen_ok', 'mt_dh_gen_retry', 'mt_dh_gen_fail', 'mt_set_client_DH_params');
export const isAnyBindAuthKeyInner = /*#__PURE__*/ _isAny('mt_bind_auth_key_inner');
export const isAnyRpcError = /*#__PURE__*/ _isAny('mt_rpc_error');
export const isAnyRpcDropAnswer = /*#__PURE__*/ _isAny('mt_rpc_answer_unknown', 'mt_rpc_answer_dropped_running', 'mt_rpc_answer_dropped', 'mt_rpc_drop_answer');
export const isAnyFutureSalt = /*#__PURE__*/ _isAny('mt_future_salt');
export const isAnyFutureSalts = /*#__PURE__*/ _isAny('mt_future_salts', 'mt_get_future_salts');
export const isAnyPong = /*#__PURE__*/ _isAny('mt_pong', 'mt_ping', 'mt_ping_delay_disconnect');
export const isAnyDestroySessionRes = /*#__PURE__*/ _isAny('mt_destroy_session_ok', 'mt_destroy_session_none', 'mt_destroy_session');
export const isAnyNewSession = /*#__PURE__*/ _isAny('mt_new_session_created');
export const isAnyMsgsAck = /*#__PURE__*/ _isAny('mt_msgs_ack');
export const isAnyBadMsgNotification = /*#__PURE__*/ _isAny('mt_bad_msg_notification', 'mt_bad_server_salt');
export const isAnyMsgResendReq = /*#__PURE__*/ _isAny('mt_msg_resend_req');
export const isAnyMsgsStateReq = /*#__PURE__*/ _isAny('mt_msgs_state_req');
export const isAnyMsgsStateInfo = /*#__PURE__*/ _isAny('mt_msgs_state_info');
export const isAnyMsgsAllInfo = /*#__PURE__*/ _isAny('mt_msgs_all_info');
export const isAnyMsgDetailedInfo = /*#__PURE__*/ _isAny('mt_msg_detailed_info', 'mt_msg_new_detailed_info');
export const isAnyDestroyAuthKeyRes = /*#__PURE__*/ _isAny('mt_destroy_auth_key_ok', 'mt_destroy_auth_key_none', 'mt_destroy_auth_key_fail', 'mt_destroy_auth_key');
export const isAnyHttpWait = /*#__PURE__*/ _isAny('mt_http_wait');

