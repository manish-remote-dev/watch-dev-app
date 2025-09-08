const { API_ENDPOINT, BASE_URL } = require("../config");
const { asyncApiRequest, intervalManager } = require("./lib");
const { executeQuery, getRows } = require("../sqlitedb/sqlitedb");

async function syncLostInternetConnectivityToMongoDB() {
    const selectInternetConnectivityQuery = "SELECT * FROM internet_connectivity_lost_logs";
    const selectTaskTimeSegmentResponse = await getRows(selectInternetConnectivityQuery);

    if(!selectTaskTimeSegmentResponse) {
        return null
    }
    if (selectTaskTimeSegmentResponse && selectTaskTimeSegmentResponse.length > 0) {
        const payload = selectTaskTimeSegmentResponse;
        const url = BASE_URL.WATCH_API_BASE_URL + API_ENDPOINT.LOG_INTERNET_CHECK;
        try{
            const requestInfo = {
                method: "POST",
                url: url,
                authType: 'bearertoken',
                requestData: payload
            }
            const result = await asyncApiRequest(requestInfo);
            const res = result.data.data;
            if (res.successIDs && res.successIDs.length > 0) {
                const sqlQuery = "DELETE FROM internet_connectivity_lost_logs WHERE id IN (" + res.successIDs.join(',') + ")";
                const deleteResponse = await executeQuery(sqlQuery);
                if (deleteResponse.changes && parseInt(deleteResponse.changes) > 0) {
                    return true;
                }
            }
        }
        catch(e){
            console.log("ERROR from syncLostInternetConnectivityToMongoDB ==>", e);
        }
    }
}

module.exports = {
    syncLostInternetConnectivityToMongoDB
}