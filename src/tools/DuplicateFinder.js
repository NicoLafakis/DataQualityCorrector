import React, { useState, useCallback } from 'react';
import { hubSpotApiRequest } from '../api';
import { Spinner, CheckCircleIcon, ExclamationCircleIcon } from '../ui';

export const DuplicateFinder = ({ token }) => {
    const [duplicates, setDuplicates] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isMerging, setIsMerging] = useState(false);
    const [error, setError] = useState('');
    const [status, setStatus] = useState('');
    const [mergeStatus, setMergeStatus] = useState({});

    const findDuplicatesByEmail = useCallback(async () => {
        setIsLoading(true);
        setError('');
        setStatus('Finding duplicates by email...');
        setDuplicates([]);
        setMergeStatus({});
        try {
            let allContacts = [];
            let after = undefined;
            do {
                const path = `/crm/v3/objects/contacts?limit=100&properties=email,firstname,lastname,createdate${after ? `&after=${after}` : ''}`;
                const data = await hubSpotApiRequest(path, 'GET', token);
                allContacts = [...allContacts, ...data.results];
                after = data.paging?.next?.after;
            } while (after);

            const emails = allContacts.reduce((acc, contact) => {
                const email = contact.properties.email?.toLowerCase();
                if (email) {
                    if (!acc[email]) acc[email] = [];
                    acc[email].push(contact);
                }
                return acc;
            }, {});

            const foundDuplicates = Object.values(emails).filter(group => group.length > 1);
            setDuplicates(foundDuplicates);
            setStatus(foundDuplicates.length > 0 ? `Found ${foundDuplicates.length} sets of duplicates.` : 'No duplicates found by email.');

        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    const handleMerge = async (group) => {
        if (group.length < 2) return;
        setIsMerging(true);
        const sortedGroup = group.sort((a,b) => new Date(b.properties.createdate) - new Date(a.properties.createdate));
        const primaryRecord = sortedGroup[0];
        const recordsToMerge = sortedGroup.slice(1);

        for (const recordToMerge of recordsToMerge) {
            setMergeStatus(prev => ({...prev, [recordToMerge.id]: 'merging'}));
            try {
                const path = `/crm/v3/objects/contacts/${primaryRecord.id}/merge`;
                const body = { objectIdToMerge: recordToMerge.id };
                await hubSpotApiRequest(path, 'POST', token, body);
                setMergeStatus(prev => ({...prev, [recordToMerge.id]: 'merged'}));
            } catch (err) {
                 setError(`Failed to merge ${recordToMerge.id}: ${err.message}`);
                 setMergeStatus(prev => ({...prev, [recordToMerge.id]: 'failed'}));
            }
        }
        
        await findDuplicatesByEmail(); 
        setIsMerging(false);
    };

    const getStatusIndicator = (status) => {
        switch (status) {
            case 'merging': return <Spinner />;
            case 'merged': return <CheckCircleIcon />;
            case 'failed': return <ExclamationCircleIcon />;
            default: return null;
        }
    };

    return (
        <div className="p-8">
            <div className="flex items-center space-x-4 mb-8">
                <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center">
                    <DocumentDuplicateIcon className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                    <h2 className="text-2xl font-semibold text-slate-900">Duplicate Management</h2>
                    <p className="text-slate-600">Find and merge duplicate records based on email addresses</p>
                </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-medium text-slate-900 mb-1">Duplicate Detection</h3>
                        <p className="text-sm text-slate-600">Scan for duplicate records by email address</p>
                    </div>
                </div>

                <div className="flex items-center">
                    <button
                        onClick={findDuplicatesByEmail}
                        disabled={isLoading || isMerging}
                        className="inline-flex items-center px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading ? <Spinner /> : (
                            <>
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                Find Contact Duplicates
                            </>
                        )}
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                    <div className="flex items-center">
                        <ExclamationCircleIcon />
                        <p className="ml-3 text-sm text-red-800">{error}</p>
                    </div>
                </div>
            )}

            {(isLoading || status) && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
                    <div className="flex items-center">
                        <Spinner />
                        <p className="ml-3 text-sm text-orange-800">{status}</p>
                    </div>
                </div>
            )}

            {duplicates.length > 0 && (
                <div className="space-y-6">
                    {duplicates.map((group, index) => (
                        <div key={index} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                                <h3 className="text-lg font-medium text-slate-900">Duplicate Set {index + 1}</h3>
                                <p className="text-sm text-slate-600">
                                    {group.length} records with email: <span className="font-mono text-orange-700">{group[0].properties.email}</span>
                                </p>
                            </div>
                            <div className="p-6">
                                <div className="space-y-3 mb-6">
                                    {group.map(record => (
                                        <div key={record.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                                                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <div className="font-medium text-slate-900">
                                                        {record.properties.firstname} {record.properties.lastname}
                                                    </div>
                                                    <div className="text-sm text-slate-500">ID: {record.id}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                {getStatusIndicator(mergeStatus[record.id])}
                                                {mergeStatus[record.id] && (
                                                    <span className="text-xs text-slate-500 capitalize">
                                                        {mergeStatus[record.id]}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={() => handleMerge(group)}
                                    disabled={isMerging}
                                    className="w-full inline-flex items-center justify-center px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isMerging ? <Spinner /> : (
                                        <>
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2m0 0V6a2 2 0 012-2h10a2 2 0 012 2v10z" />
                                            </svg>
                                            Merge All into Newest Record
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!isLoading && !error && duplicates.length === 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircleIcon />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-2">No Duplicates Found</h3>
                    <p className="text-slate-600">Your contact records are clean! No duplicate email addresses were detected.</p>
                </div>
            )}
        </div>
    );
};
