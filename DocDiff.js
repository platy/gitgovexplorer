import { h, render, Component } from 'preact';
import HtmlDiff from 'htmldiff-js';
import './normalize.min.css';
// import './mercury.min.css';
import './style.css';


function getRaw(owner, repo, filepath, sha) {
	const url = `https://raw.githubusercontent.com/${owner}/${repo}/${sha}/${filepath}`;
	return fetch(url, { mode: 'cors' }).then( response => {
		if (response.ok)
            return response.text();
	});
}

export default class DocDiff extends Component {
	constructor({ owner, repo, filename, sha, parent, commits }) {
		super();
		if (commits) {
			this.state = { commit: commits[sha] }
		}
		const rawFrom = getRaw(owner, repo, filename, parent );
		const rawTo = getRaw(owner, repo, filename, sha);
		rawFrom.then(rawfrom => {
			rawTo.then(rawto => {
				this.setState({ 
					diff: HtmlDiff.execute(rawfrom || '', rawto || ''),
				 });
			});
		});
	}

	changeType(sha, parent) {
		if (parent) {
			return <p>Showing diff : {sha}..{parent}</p>
		} else {
			return <p>Showing previously unseen document : {sha}</p>
		}
	}

	render({ filename, sha, parent }, { diff, commit: { message } }) {
		const original_url = `https://www.gov.uk/${filename}`
		return (<section>
			<header class="commit-info">
				<p>Original document : <a href={original_url}>{original_url}</a></p>
				<p>Change description : {message}</p>
				{this.changeType(sha, parent)}
			</header>
			<div class="diff" dangerouslySetInnerHTML={ { __html: diff } } />
		</section>)
		// return <div>{ diff } } </div>;
	}
}
