/* eslint-disable react/no-did-mount-set-state */
import { h, render, Component } from 'preact';
import Router from 'preact-router';
import Waypoint from 'preact-waypoint';
import Octokit from '@octokit/rest';
import DocDiff from 'async!./DocDiff'
import './normalize.min.css';
// import './mercury.min.css';
import './style.css';
import he from 'he';

const octokit = new Octokit({ baseUrl: "https://gitgovuk.njk.onl" });

function CommitLogElement({ owner, repo, sha, commit }) {
	if (commit) {
		let { message, parents, files, date } = commit;

		if (files.length == 1) {
			return (
				<a href={`/diff/${sha}/${parents[0]}/${files[0].filename}`}>
					<ul>
						<li class={files[0].status}>{files[0].filename}</li>
					</ul>
					<p>{ message }</p>
				</a>
			)
		} else {
			return (<li><ul>
				{files.map(({ filename, status }) => (
					<li class={status}>
						<a href={`/diff/${sha}/${parents[0]}/${filename}`}>{ filename }</a>
					</li>))}
			</ul>
			<p>{message}</p>
			</li>);
		}
	}
	return <li />;
}

class CommitLog extends Component {
	state = { log: [], renderCount: 10, commits: {} }
	commitStatesLoading = false;

	requestCommitState(sha) {
		if (!this.state.commits[sha]) {
			const { owner, repo } = this.props;
			octokit.repos.getCommit({ owner, repo, commit_sha: sha }).then(result => {
				const commits = this.state.commits;
				let { commit: { message, author: { date } }, parents, files } = result.data;
				commits[sha] = { 
					message: he.decode(message), 
					parents: parents.map(({ sha }) => sha),
					files: files.map(({ filename, status }) => ({ filename, status })),
					date,
				};
				this.setState({ commits });

				this.commitStatesLoading = !this.state.log.every(sha => commits[sha])
				if (!this.commitStatesLoading) {
					this.serialiseCommits();

					this.loadingCompleted();
				}
			});
		}
	}

	loadingCompleted() {
		console.log('loading completed')
		// check if we should already load more commits to fill the window
		if (!this.state.allLoaded && document.body.getBoundingClientRect().bottom < window.innerHeight) {
			console.log('loding completed but screen not full')
			this.renderMore();
		}
	}

	requestOlderCommitShas() {
		console.log('requesting older')
		this.iterator.next().then(result => {
			if (result.done) {
				console.log('got everything')
			} else {
				const newShas = result.value.data.map(({ sha }) => sha)
				this.setState({ log: this.state.log.concat(newShas) });
				for (const sha of newShas) {
					this.requestCommitState(sha)
				}
				this.commitStatesLoading = this.commitStatesLoading || !newShas.every(sha => this.state.commits[sha])
				if (!this.commitStatesLoading) {
					this.loadingCompleted();
				}
			}
		});
	}

	/** Returns true once all of the logs have been downloaded and rendered */
	areAllRendered() {
		return this.state.allLoaded && this.state.renderCount > this.state.log.length;
	}

	displayedLogs() {
		const { renderCount, log } = this.state;
		return log.slice(0, renderCount);
	}

	constructor ({ owner, repo }) {
		super();
		const listCommitsRequest = octokit.repos.listCommits.endpoint.merge({ owner, repo });
		this.iterator = octokit.paginate.iterator(listCommitsRequest)[Symbol.asyncIterator]();
		this.loadCommitsInitial();
	}

	/** Change state to increase number of log entries shown, and download more if necessary */
	renderMore = () => {
		console.log('rendering more')
		const renderCount = this.state.renderCount + 10;
		this.setState({ renderCount });
		if (renderCount >= this.state.log.length && !this.state.allLoaded) {
			this.requestOlderCommitShas();
		} else {
			this.commitStatesLoading = !this.state.log.every(sha => this.state.commits[sha])
			if (!this.commitStatesLoading) {
				this.loadingCompleted();
			}
		}
	}

	renderLog(owner, repo, commits) {
		var lastDate
		return this.displayedLogs().map(commitSha => {
			let commit = commits[commitSha];
			let date = commit && commit.date.split('T')[0]
			let element = <CommitLogElement owner={owner} repo={repo} sha={commitSha} commit={commit} />
			if (date && (!lastDate || lastDate !== date)) {
				lastDate = date
				return [<h3>{date.split('T')[0]}</h3>, element]
			}
			return element
		} )
	}

	render({ owner, repo }, { log, renderCount, allLoaded, commits }) {
		if (log.length === 0) {
			return <p>No commits for { owner }/{ repo }</p>;
		}
		return (
			<Router>
				<div path="/">
					<header>
						<h1>UK Government Brexit advice update diffs</h1>
						<p>List of Brexit updates provided by the UK government since 2019-04-09, the updates are displayed in the order in which the government provided them over their <a href="https://www.gov.uk/government/brexit">brexit notification service</a>. The raw data is stored in <a href="https://github.com/platy/gitgovuk/commits/">github.com/platy/gitgovuk</a>, this site provides an improved view of document diffs for modified documents. This website is not affiliated with the UK government.</p>
						<div class="open-government-licence">
							<span class="logo"><a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" rel="license">Open Government Licence</a></span>
							<span>All content is available under the <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" rel="license">Open Government Licence v3.0</a>, except where otherwise stated</span>
						</div>
					</header>
					<ol class="commit-log">
						<tr class="table-header">
							<th>Filename on gov.uk</th>
							<th>Change description</th>
						</tr>
						{ this.renderLog(owner, repo, commits) }
						{ !this.areAllRendered() && <Waypoint onEnter={this.renderMore} /> }
					</ol>
				</div>
				<DocDiff path="/diff/:sha/:parent/:filename*" owner={owner} repo={repo} commits={commits} />
				<div default>Unknown route</div>
			</Router>
		);
	}

	loadCommitsInitial() {
		if (window.localStorage.getItem("storageVersion") === "1") {
			console.log("Preloading commits from local storage")
			const commitsSerial = window.localStorage.getItem("commits");
			if (commitsSerial) {
				this.state.commits = JSON.parse(commitsSerial);
			}
		}
		this.requestOlderCommitShas();
	}

	serialiseCommits() {
		const serializedCommits = JSON.stringify(this.state.commits);
		window.localStorage.setItem('commits', serializedCommits);
		window.localStorage.setItem('storageVersion', "1");
	}
}

render((
	<CommitLog owner="platy" repo="gitgovuk" />
), document.body);
